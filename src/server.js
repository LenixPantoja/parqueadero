const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');

// --- REGISTRO DE ERRORES ---
// Esto es crucial para depurar el .exe
const logStream = fs.createWriteStream(path.join(__dirname, '..', 'log.txt'), { flags: 'a' });
const logError = (message) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.error(message);
};
process.on('uncaughtException', (err) => {
    logError(`Error no capturado: ${err.stack || err}`);
    process.exit(1);
});
// Carga las variables de entorno desde el .env, asegurando que funcione en el .exe
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });


const app = express();

// Detecta si está empaquetado con pkg para determinar la ruta base correcta.
const isPackaged = !!process.pkg;
const basePath = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(basePath, 'public')));

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
        return res.sendFile(path.join(basePath, 'public', 'admin', `${cleanPage}.html`));
    }
    next();
});

// ---------------- 404 ----------------
app.use((req, res) => {
    res.status(404).sendFile(path.join(basePath, 'public', '404.html'));
});

// ---------------- SERVIDOR LAN ----------------
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Obligatorio para LAN
const isProduction = process.env.NODE_ENV === 'production';

try {
    if (isProduction) {
        // En producción (web), corre en HTTP. El proxy inverso (Nginx, etc.) manejará HTTPS.
        app.listen(PORT, HOST, () => {
            console.log(`Servidor de producción corriendo en http://${HOST}:${PORT}`);
        });
    } else {
        // En desarrollo (local), usa HTTPS con certificados autofirmados.
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
    }
} catch (error) {
    // Si falla al iniciar el servidor (ej. no encuentra los certificados), lo registramos.
    logError(`Error al iniciar el servidor HTTPS: ${error.stack || error}`);
    process.exit(1); // Cierra la aplicación con un código de error.
}
