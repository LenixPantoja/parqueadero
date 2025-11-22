// public/js/sidebar.js

/**
 * Carga dinámicamente el nombre y el logo de la empresa en el menú lateral.
 * Utiliza localStorage para cachear los datos y evitar peticiones repetidas.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const logoTextEl = document.getElementById('sidebarLogoText');
    const logoImgEl = document.getElementById('sidebarLogoImg');
    const companyNameEl = document.getElementById('sidebarCompanyName');
    const spinnerEl = document.getElementById('sidebarSpinner');

    if (!companyNameEl || !logoTextEl || !logoImgEl) return;

    try {
        // Intentar cargar desde localStorage primero
        const cachedName = localStorage.getItem('empresaNombre');
        const cachedLogoUrl = localStorage.getItem('empresaLogoUrl');

        if (cachedName) companyNameEl.textContent = cachedName;
        if (cachedLogoUrl) {
            logoImgEl.src = cachedLogoUrl;
            if (spinnerEl) spinnerEl.classList.add('d-none');
            logoImgEl.classList.remove('d-none');
            logoTextEl.classList.add('d-none');
        }

        // Fetch para datos frescos
        const res = await fetch('/api/empresa/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const { data } = await res.json();
        
        localStorage.setItem('empresaNombre', data.nombre);
        companyNameEl.textContent = data.nombre;

        // Cargar y mostrar el logo si existe
        const logoRes = await fetch('/api/empresa/logo', { headers: { 'Authorization': `Bearer ${token}` } });
        if (logoRes.ok) {
            const blob = await logoRes.blob();
            const logoUrl = URL.createObjectURL(blob);
            localStorage.setItem('empresaLogoUrl', logoUrl); // Cachear URL del blob
            logoImgEl.src = logoUrl;
            if (spinnerEl) spinnerEl.classList.add('d-none');
            logoImgEl.classList.remove('d-none');
            logoTextEl.classList.add('d-none');
        } else {
            // Si no hay logo, mostrar el texto de fallback
            if (spinnerEl) spinnerEl.classList.add('d-none');
            logoTextEl.classList.remove('d-none');
        }
    } catch (error) {
        console.warn('No se pudo cargar la información de la empresa en el sidebar.', error);
        // En caso de error, mostrar el texto de fallback
        if (spinnerEl) spinnerEl.classList.add('d-none');
        logoTextEl.classList.remove('d-none');
    }

    // --- Agregar botón de Ayuda al pie del sidebar ---
    try {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !document.getElementById('sidebarHelpLink')) {
            const helpLink = document.createElement('a');
            helpLink.id = 'sidebarHelpLink';
            helpLink.href = 'https://api.whatsapp.com/send?phone=3158357923&text=Hola,Necesito%20ayuda%20con%20el%20sistema%20de%20parqueadero.';
            helpLink.target = '_blank';
            helpLink.rel = 'noopener noreferrer';
            
            // Estilos para que se parezca a un item de menú y se posicione abajo
            helpLink.className = 'nav-link text-white text-center mt-auto';
            helpLink.style.padding = '1rem';
            helpLink.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
            helpLink.style.textDecoration = 'none';
            helpLink.style.marginTop = 'auto'; // Empuja el enlace al final

            helpLink.innerHTML = '<i class="fab fa-whatsapp me-2"></i>Ayuda y Soporte';

            // Para que el enlace se vaya al final, el contenedor del menú debe ser flex
            const sidebarNav = sidebar.querySelector('.nav');
            if (sidebarNav) {
                sidebarNav.style.display = 'flex';
                sidebarNav.style.flexDirection = 'column';
                sidebarNav.style.height = '100%';
                sidebarNav.appendChild(helpLink);
            } else {
                sidebar.appendChild(helpLink);
            }
        }
    } catch (error) {
        console.warn('No se pudo agregar el botón de ayuda al sidebar.', error);
    }
});