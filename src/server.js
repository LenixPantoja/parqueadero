const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Determina ruta base según entorno (desarrollo vs ejecutable pkg)
// Cuando se empaqueta con pkg, process.pkg existe y el ejecutable vive en process.execPath
// Esto permite servir la carpeta "public" que se copiará junto al .exe en dist/public
const isPackaged = !!process.pkg;
const basePath = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');
const publicDir = path.join(basePath, 'public');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// Rutas API
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

// Servir todas las vistas del panel de administración (admin y operador)
// Esto captura rutas como /admin/dashboard, /operador/vehiculos, etc.
app.get('/:role(admin|operador)/:page', (req, res, next) => {
    const { page } = req.params;
    const allowedPages = ['dashboard', 'vehiculos', 'ingreso-salida', 'configuracion', 'tarifas', 'usuarios', 'reportes'];
    if (allowedPages.includes(page.replace('.html', ''))) {
        res.sendFile(path.join(publicDir, 'admin', `${page.replace('.html', '')}.html`));
    } else {
        next(); // Si no es una página válida, pasa al siguiente manejador (404)
    }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red disponibles

app.listen(PORT, HOST, () => {
    console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    console.log('Ahora es accesible desde otros dispositivos en la misma red.');
    
});