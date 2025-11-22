// Esperar a que el documento esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si ya hay un token válido
    const token = localStorage.getItem('token');
    if (token) {
        redirectToDashboard(localStorage.getItem('userRole'));
        return;
    }

    // Obtener elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const toggleIcon = document.getElementById('toggleIcon');

    // Función para alternar la visibilidad de la contraseña
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Cambiar el ícono
        if (type === 'password') {
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
        } else {
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
        }
    });

    // Función para validar el formulario
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        event.stopPropagation();

        // Validar el formulario usando las clases de Bootstrap
        if (loginForm.checkValidity()) {
            // Obtener los valores del formulario
            const empresa = document.getElementById('empresa').value;
            const usuario = document.getElementById('usuario').value;
            const password = document.getElementById('password').value;
            const recordar = document.getElementById('recordar').checked;

            try {
                mostrarCargando();
                
                // Enviar datos al servidor
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ empresa, usuario, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Error en el inicio de sesión');
                }

                // Guardar token y datos del usuario
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('userName', data.data.nombre);
                localStorage.setItem('userRole', data.data.rol);
                localStorage.setItem('empresaId', data.data.id_empresa);
                localStorage.setItem('empresaNit', empresa);

                // Marcar el día de login (YYYY-MM-DD) para mostrar el banner diario una vez
                try {
                    var today = new Date();
                    var yyyy = today.getFullYear();
                    var mm = String(today.getMonth()+1).padStart(2,'0');
                    var dd = String(today.getDate()).padStart(2,'0');
                    localStorage.setItem('gfLoginDay', yyyy+'-'+mm+'-'+dd);
                    // Al iniciar sesión, reiniciar el recordatorio de cierre para el nuevo día
                    localStorage.removeItem('gfDismissedDay');
                } catch(_e) {}

                // Guardar datos si recordar está marcado
                if (recordar) {
                    localStorage.setItem('savedUsername', usuario);
                    localStorage.setItem('savedEmpresa', empresa);
                } else {
                    localStorage.removeItem('savedUsername');
                    localStorage.removeItem('savedEmpresa');
                }

                // Redireccionar según el rol
                redirectToDashboard(data.data.rol);

            } catch (error) {
                mostrarError(error.message);
                restaurarBoton();
            }
        }

        loginForm.classList.add('was-validated');
    });

    // Función para redireccionar al dashboard
    function redirectToDashboard(rol) {
        const baseUrl = window.location.origin;
        const dashboardUrl = rol === 'admin' ? '/admin/dashboard' : '/operador/dashboard';
        window.location.href = baseUrl + dashboardUrl;
    }

    // Función para mostrar el estado de carga
    function mostrarCargando() {
        const boton = loginForm.querySelector('button[type="submit"]');
        boton.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Iniciando sesión...
        `;
        boton.disabled = true;
    }

    // Función para restaurar el botón
    function restaurarBoton() {
        const boton = loginForm.querySelector('button[type="submit"]');
        boton.innerHTML = 'Iniciar Sesión';
        boton.disabled = false;
    }

    // Función para mostrar errores
    function mostrarError(mensaje) {
        // Crear el elemento de alerta
        const alertaDiv = document.createElement('div');
        alertaDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
        alertaDiv.role = 'alert';
        alertaDiv.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        // Insertar la alerta antes del formulario
        loginForm.parentNode.insertBefore(alertaDiv, loginForm);

        // Eliminar la alerta después de 5 segundos
        setTimeout(() => {
            alertaDiv.remove();
        }, 5000);
    }

    // Cargar datos guardados si existen
    const usuarioGuardado = localStorage.getItem('savedUsername');
    const empresaGuardada = localStorage.getItem('savedEmpresa');
    
    if (usuarioGuardado && empresaGuardada) {
        document.getElementById('usuario').value = usuarioGuardado;
        document.getElementById('empresa').value = empresaGuardada;
        document.getElementById('recordar').checked = true;
    }

    // --- Agregar botón de contacto en la página de login ---
    try {
        const loginForm = document.getElementById('loginForm');
        if (loginForm && !document.getElementById('loginContactLink')) {
            const contactLink = document.createElement('a');
            contactLink.id = 'loginContactLink';
            contactLink.href = 'https://api.whatsapp.com/send?phone=3158357923&text=%C2%A1Hola!%20%F0%9F%91%8B%F0%9F%9A%97%20Estoy%20interesado%20en%20informaci%C3%B3n%20sobre%20el%20sistema%20de%20parqueadero%20EASY%20PARKING%20%F0%9F%85%BF%EF%B8%8F%E2%9C%A8';
            contactLink.target = '_blank';
            contactLink.rel = 'noopener noreferrer';
            contactLink.className = 'btn btn-success mt-3 w-100'; // Botón verde de ancho completo
            contactLink.innerHTML = '<i class="fab fa-whatsapp me-2"></i> Contactar para obtener el sistema';

            loginForm.insertAdjacentElement('afterend', contactLink);
        }
    } catch (error) {
        console.warn('No se pudo agregar el botón de contacto.', error);
    }
});