const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Detecta si está empaquetado con pkg
const isPackaged = !!process.pkg;

// Base path según entorno
const basePath = isPackaged
    ? path.dirname(process.execPath)   // cuando es .exe
    : path.join(__dirname, '..');      // modo desarrollo

const publicDir = path.join(basePath, 'public');

// Middleware
app.use(cors({
    origin: '*', // Permite solicitudes desde toda la red LAN
}));
app.use(express.json());
app.use(express.static(publicDir));

// ---------------- RUTAS API ----------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehiculos', require('./routes/vehiculos'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/empresa', require('./routes/empresa'));
app.use('/api/tarifas', require('./routes/tarifas'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/turnos', require('./routes/turnos'));


// ---------------- RUTAS DEL PANEL ----------------
app.get('/:role(admin|operador)/:page', (req, res, next) => {
    const { page } = req.params;
    const allowedPages = [
        'dashboard', 'vehiculos', 'ingreso-salida',
        'configuracion', 'tarifas', 'usuarios', 'reportes'
    ];

    const cleanPage = page.replace('.html', '');

    if (allowedPages.includes(cleanPage)) {
        return res.sendFile(path.join(publicDir, 'admin', `${cleanPage}.html`));
    }
    next();
});

// ---------------- 404 ----------------
app.use((req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// ---------------- SERVIDOR LAN ----------------
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Obligatorio para LAN

try {
    // Opciones para el servidor HTTPS, usando los certificados generados
    const httpsOptions = {
        key: fs.readFileSync(path.join(basePath, 'key.pem')),
        cert: fs.readFileSync(path.join(basePath, 'cert.pem'))
    };

    https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
        console.log('===================================================');
        console.log(`Servidor HTTPS corriendo en LAN en puerto ${PORT}`);
        console.log(`Accede desde otros dispositivos en tu red usando:`);
        console.log(`https://<IP-DE-TU-COMPUTADOR>:${PORT}`);
        console.log('===================================================');
    });
} catch (error) {
    console.error('Error al iniciar el servidor HTTPS. ¿Generaste los certificados "key.pem" y "cert.pem"?');
    console.error('Ejecuta este comando en la raíz del proyecto: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes');
}
