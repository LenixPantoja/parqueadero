const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { sanitizeIdParam } = require('../utils/sanitize');

// Middleware de autenticación
router.use(auth);

async function getTurnoAbierto(id_empresa){
    const [rows] = await pool.query(
        'SELECT * FROM turnos WHERE id_empresa=? AND estado="abierto" ORDER BY fecha_apertura DESC LIMIT 1',
        [id_empresa]
    );
    return rows[0] || null;
}

async function getTotalesSistema(id_empresa, fecha_desde, fecha_hasta){
    const [rows] = await pool.query(
        `SELECT 
            SUM(CASE WHEN metodo_pago='efectivo' THEN monto ELSE 0 END) AS efectivo,
            SUM(CASE WHEN metodo_pago='tarjeta' THEN monto ELSE 0 END) AS tarjeta,
            SUM(CASE WHEN metodo_pago='Nequi' THEN monto ELSE 0 END) AS nequi,
            SUM(monto) AS total
         FROM pagos
         WHERE id_empresa=? AND fecha_pago BETWEEN ? AND COALESCE(?, NOW())`,
        [id_empresa, fecha_desde, fecha_hasta || null]
    );
    const r = rows[0] || {};
    return {
        efectivo: Number(r.efectivo||0),
        tarjeta: Number(r.tarjeta||0),
        nequi: Number(r.nequi||0),
        total: Number(r.total||0)
    };
}

async function getConteoTickets(id_empresa, fecha_desde, fecha_hasta){
    const [rows] = await pool.query(
        `SELECT v.tipo, COUNT(*) as cnt
         FROM movimientos m
         JOIN vehiculos v ON v.id_vehiculo = m.id_vehiculo
         WHERE m.id_empresa=? AND m.estado='finalizado'
           AND m.fecha_salida BETWEEN ? AND COALESCE(?, NOW())
         GROUP BY v.tipo`,
        [id_empresa, fecha_desde, fecha_hasta || null]
    );
    const map = { carro:0, moto:0, bici:0 };
    rows.forEach(r=>{ if (map[r.tipo]!=null) map[r.tipo] = Number(r.cnt||0); });
    return { total: map.carro + map.moto + map.bici, porTipo: map };
}

// Obtener turno activo de la empresa
router.get('/actual', async (req, res) => {
    try{
        const { id_empresa } = req.user;
        const t = await getTurnoAbierto(id_empresa);
        res.json({ success:true, data: t });
    }catch(err){
        res.status(500).json({ success:false, message:'Error obteniendo turno' });
    }
});

// Resumen de totales del sistema desde la apertura del turno activo
router.get('/resumen', async (req, res) => {
    try{
        const { id_empresa } = req.user;
        const t = await getTurnoAbierto(id_empresa);
        if (!t) return res.status(400).json({ success:false, message:'No hay turno abierto' });
        const tot = await getTotalesSistema(id_empresa, t.fecha_apertura, t.fecha_cierre);
        const stats = await getConteoTickets(id_empresa, t.fecha_apertura, t.fecha_cierre);
        res.json({ success:true, data:{ turno:t, totales: tot, stats } });
    }catch(err){
        res.status(500).json({ success:false, message:'Error calculando totales' });
    }
});

// Abrir turno
router.post('/abrir', async (req, res) => {
    try{
        const { id_empresa, id: id_usuario } = req.user;
        const { base_inicial, observacion_apertura } = req.body;
        // Validar que no haya uno abierto
        const [abiertos] = await pool.query(
            'SELECT id_turno FROM turnos WHERE id_empresa=? AND estado="abierto"',
            [id_empresa]
        );
        if (abiertos.length){
            return res.status(400).json({ success:false, message:'Ya existe un turno abierto' });
        }
        const [result] = await pool.query(
            'INSERT INTO turnos (id_empresa,id_usuario,base_inicial,observacion_apertura) VALUES (?,?,?,?)',
            [id_empresa, id_usuario, Number(base_inicial||0), observacion_apertura||null]
        );
        res.json({ success:true, data:{ id_turno: result.insertId } });
    }catch(err){
        res.status(500).json({ success:false, message:'Error abriendo turno' });
    }
});

// Cerrar turno: calcula totales por método en rango [apertura, ahora]
router.post('/cerrar', async (req, res) => {
    try{
        const { id_empresa } = req.user;
        const { total_efectivo, total_tarjeta, total_nequi, total_general, observacion_cierre } = req.body;
        const t = await getTurnoAbierto(id_empresa);
        if (!t){
            return res.status(400).json({ success:false, message:'No hay turno abierto' });
        }
        const id_turno = t.id_turno;
        const expected = await getTotalesSistema(id_empresa, t.fecha_apertura, t.fecha_cierre);
        const userTotals = {
            efectivo: Number(total_efectivo||0),
            tarjeta: Number(total_tarjeta||0),
            nequi: Number(total_nequi||0),
            total: Number(total_general||0)
        };
        const diff = Number((userTotals.total - expected.total).toFixed(2));
        await pool.query(
            'UPDATE turnos SET fecha_cierre=CURRENT_TIMESTAMP, total_efectivo=?, total_tarjeta=?, total_nequi=?, total_general=?, diferencia=?, observacion_cierre=?, estado="cerrado" WHERE id_turno=?',
            [userTotals.efectivo, userTotals.tarjeta, userTotals.nequi, userTotals.total, diff, observacion_cierre||null, id_turno]
        );
        const [fresh] = await pool.query('SELECT * FROM turnos WHERE id_turno=?', [id_turno]);
        const cierre = fresh[0];
        const stats = await getConteoTickets(id_empresa, t.fecha_apertura, cierre.fecha_cierre);
        res.json({ success:true, data:{ id_turno, base: t.base_inicial, expected, userTotals, diferencia: diff, stats, turno: { id_turno, usuario: req.user.nombre } } });
    }catch(err){
        res.status(500).json({ success:false, message:'Error cerrando turno' });
    }
});

// Detalle de turno + totales del sistema para reimpresión
router.get('/detalle/:id', sanitizeIdParam('id'), async (req, res) => {
    try{
        const { id_empresa } = req.user;
        const id_turno = req.params.id;
        const [rows] = await pool.query(
            `SELECT t.*, u.nombre AS usuario, u.usuario_login
             FROM turnos t
             JOIN usuarios u ON u.id_usuario = t.id_usuario
             WHERE t.id_empresa=? AND t.id_turno=?`,
            [id_empresa, id_turno]
        );
        if (!rows.length) return res.status(404).json({ success:false, message:'Turno no encontrado' });
        const t = rows[0];
        const expected = await getTotalesSistema(id_empresa, t.fecha_apertura, t.fecha_cierre);
        const stats = await getConteoTickets(id_empresa, t.fecha_apertura, t.fecha_cierre);
        res.json({ success:true, data:{ turno: t, expected, stats } });
    }catch(err){
        res.status(500).json({ success:false, message:'Error obteniendo detalle de turno' });
    }
});

// Generar comprobante de cierre de turno en PDF
router.get('/cierre-pdf/:id', sanitizeIdParam('id'), async (req, res) => {
    try {
        const { id_empresa, nombre: nombre_usuario_actual } = req.user;
        const id_turno = req.params.id;

        // Obtener info de la empresa
        const [empresaRows] = await pool.query(
            'SELECT nombre, nit FROM empresas WHERE id_empresa = ?',
            [id_empresa]
        );
        const empresaInfo = empresaRows[0] || { nombre: 'Parqueadero', nit: '' };

        // 1. Obtener los datos del turno (reutilizando la lógica de /detalle)
        const [rows] = await pool.query(
            `SELECT t.*, u.nombre AS usuario, u.usuario_login
             FROM turnos t
             JOIN usuarios u ON u.id_usuario = t.id_usuario
             WHERE t.id_empresa=? AND t.id_turno=?`,
            [id_empresa, id_turno]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Turno no encontrado' });
        }
        const turno = rows[0];

        // 2. Obtener totales y estadísticas
        const expected = await getTotalesSistema(id_empresa, turno.fecha_apertura, turno.fecha_cierre);
        const stats = await getConteoTickets(id_empresa, turno.fecha_apertura, turno.fecha_cierre);

        // 3. Generar el PDF
        // PDFKit no soporta 'auto' en el tamaño. Se define un ancho de 80mm (226 pts) y una altura fija grande.
        const doc = new PDFDocument({
            size: [226, 842], // Ancho de 80mm, altura de A4 (suficiente para un ticket)
            margins: { top: 15, bottom: 15, left: 15, right: 15 }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="cierre_turno_${id_turno}.pdf"`);

        doc.pipe(res);

        // --- Contenido del PDF ---
        doc.font('Helvetica-Bold').fontSize(10).text(empresaInfo.nombre.toUpperCase(), { align: 'center' });
        if (empresaInfo.nit) {
            doc.font('Helvetica').fontSize(9).text(`NIT: ${empresaInfo.nit}`, { align: 'center' });
        }
        doc.moveDown(0.5);

        doc.font('Helvetica-Bold').fontSize(12).text('CIERRE DE TURNO', { align: 'center' });
        doc.moveDown(0.5);

        doc.font('Helvetica').fontSize(9);
        doc.text(`Turno ID: ${turno.id_turno}`);
        doc.text(`Usuario: ${turno.usuario}`);
        doc.text(`Fecha Apertura: ${new Date(turno.fecha_apertura).toLocaleString('es-CO')}`);
        doc.text(`Fecha Cierre: ${new Date(turno.fecha_cierre).toLocaleString('es-CO')}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('--- INGRESOS REGISTRADOS ---');
        doc.font('Helvetica').text(`Base Inicial: $${Number(turno.base_inicial).toFixed(2)}`);
        doc.text(`Efectivo: $${expected.efectivo.toFixed(2)}`);
        doc.text(`Tarjeta: $${expected.tarjeta.toFixed(2)}`);
        doc.text(`Nequi/QR: $${expected.nequi.toFixed(2)}`);
        doc.font('Helvetica-Bold').text(`TOTAL SISTEMA: $${expected.total.toFixed(2)}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('--- ARQUEO DE CAJA ---');
        doc.font('Helvetica').text(`Efectivo Contado: $${Number(turno.total_efectivo).toFixed(2)}`);
        doc.text(`Total Tarjeta: $${Number(turno.total_tarjeta).toFixed(2)}`);
        doc.text(`Total Nequi/QR: $${Number(turno.total_nequi).toFixed(2)}`);
        doc.font('Helvetica-Bold').text(`TOTAL DECLARADO: $${Number(turno.total_general).toFixed(2)}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text(`DIFERENCIA: $${Number(turno.diferencia).toFixed(2)}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').text('--- VEHÍCULOS ATENDIDOS ---');
        doc.font('Helvetica').text(`Carros: ${stats.porTipo.carro}`);
        doc.text(`Motos: ${stats.porTipo.moto}`);
        doc.text(`Bicicletas: ${stats.porTipo.bici}`);
        doc.font('Helvetica-Bold').text(`TOTAL: ${stats.total}`);
        doc.moveDown(2);

        doc.end();

    } catch (err) {
        console.error('Error generando PDF de cierre:', err);
        res.status(500).send('Error interno del servidor al generar el PDF');
    }
});

module.exports = router;
