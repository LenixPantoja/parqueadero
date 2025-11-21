document.addEventListener('DOMContentLoaded', () => {
    // Guard de rol: solo admin
    if (localStorage.getItem('userRole') !== 'admin') { window.location.href = '/admin/dashboard'; return; }
    document.getElementById('userName').textContent = localStorage.getItem('userName') || 'Usuario';
    document.querySelector('.sidebar-toggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('show'));
    document.getElementById('btnLogout').addEventListener('click',()=>{localStorage.clear(); location.href='/';});

    loadTarifas();

    // Habilitar/deshabilitar campos según modo
    const modo = document.getElementById('modo_cobro');
    const fToggle = () => {
        const m = modo.value;
        const fields = {
            valor_minuto: m === 'minuto' || m === 'mixto',
            valor_hora: m === 'hora' || m === 'mixto' || m === 'hora_adicional',
            valor_hora_adicional: m === 'hora_adicional',
            valor_dia_completo: m === 'dia' || m === 'mixto',
            paso_minutos_a_horas: m === 'mixto',
            paso_horas_a_dias: m === 'mixto',
            redondeo_horas: m === 'mixto',
            redondeo_dias: m === 'mixto'
        };

        for (const id in fields) {
            const el = document.getElementById(id);
            const parentGroup = el.closest('.col-md-6, .col-md-4'); // Contenedor del campo
            el.disabled = !fields[id];
            if (parentGroup) parentGroup.style.display = fields[id] ? '' : 'none';
        }
    };
    modo.addEventListener('change', fToggle);
    fToggle();

    document.getElementById('tarifaForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const body = {
            tipo_vehiculo: document.getElementById('tipo_vehiculo').value,
            modo_cobro: document.getElementById('modo_cobro').value,
            valor_minuto: parseFloat(document.getElementById('valor_minuto').value||0),
            valor_hora: parseFloat(document.getElementById('valor_hora').value||0),
            valor_hora_adicional: parseFloat(document.getElementById('valor_hora_adicional').value||0),
            valor_dia_completo: parseFloat(document.getElementById('valor_dia_completo').value||0),
            paso_minutos_a_horas: parseInt(document.getElementById('paso_minutos_a_horas').value||0, 10),
            paso_horas_a_dias: parseInt(document.getElementById('paso_horas_a_dias').value||0, 10),
            redondeo_horas: document.getElementById('redondeo_horas').value,
            redondeo_dias: document.getElementById('redondeo_dias').value
        };

        const btn = e.submitter;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;

        try{
            const res = await fetch('/api/tarifas', {
                method: 'PUT',
                headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(body)
            });
            const j = await res.json();
            if(!res.ok) throw new Error(j.message||'No se pudo guardar');
            showToast('Éxito','Tarifa guardada','success');
            loadTarifas();
        }catch(err){
            showToast('Error', err.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });
});

async function loadTarifas(){
    try{
        const res = await fetch('/api/tarifas/current', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
        const j = await res.json();
        if(!res.ok) throw new Error(j.message||'Error cargando tarifas');
        const ul = document.getElementById('listaTarifas');
        const tarifasPorTipo = {};
        j.data.forEach(t => { tarifasPorTipo[t.tipo_vehiculo] = t; });

        ul.innerHTML = ['carro', 'moto', 'bici'].map(tipo => {
            const t = tarifasPorTipo[tipo];
            const icons = { carro: 'fa-car', moto: 'fa-motorcycle', bici: 'fa-bicycle' };
            
            if (!t) {
                // Mostrar un placeholder si no hay tarifa para este tipo
                return `
                <li class="list-group-item tariff-card mb-2 opacity-75">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1"><i class="fas ${icons[tipo]} me-2"></i><span class="text-capitalize">${tipo}</span></h6>
                            <span class="badge bg-secondary-soft text-secondary">Sin configurar</span>
                        </div>
                        <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('tipo_vehiculo').value='${tipo}'; window.scrollTo({top:0, behavior:'smooth'});">
                            <i class="fas fa-plus"></i> Crear
                        </button>
                    </div>
                </li>`;
            }

            const modoLabels = {
                'mixto': 'Mixto', 'hora': 'Por Hora', 'minuto': 'Por Minuto',
                'dia': 'Por Día', 'hora_adicional': 'Hora + Adicional'
            };

            let valores = '';
            if (t.modo_cobro === 'mixto') valores = `Min: ${fmt(t.valor_minuto)} | Hora: ${fmt(t.valor_hora)} | Día: ${fmt(t.valor_dia_completo)}`;
            else if (t.modo_cobro === 'hora_adicional') valores = `1ra Hora: ${fmt(t.valor_hora)} | Adicional: ${fmt(t.valor_hora_adicional)}`;
            else if (t.modo_cobro === 'hora') valores = `Valor: ${fmt(t.valor_hora)} / hora`;
            else if (t.modo_cobro === 'minuto') valores = `Valor: ${fmt(t.valor_minuto)} / min`;
            else if (t.modo_cobro === 'dia') valores = `Valor: ${fmt(t.valor_dia_completo)} / día`;

            return `
            <li class="list-group-item tariff-card mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1"><i class="fas ${icons[t.tipo_vehiculo]} me-2"></i><span class="text-capitalize">${t.tipo_vehiculo}</span></h6>
                        <span class="badge bg-primary-soft text-primary">${modoLabels[t.modo_cobro] || t.modo_cobro}</span>
                    </div>
                    <button class="btn btn-sm btn-outline-secondary" onclick='editarTarifa(${JSON.stringify(t)})'>
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
                <div class="mt-2 pt-2 border-top">
                    <small class="text-muted">${valores}</small>
                </div>
            </li>
            `;
        }).join('');
    }catch(err){
        showToast('Error', err.message, 'danger');
    }
}

function editarTarifa(tarifa) {
    for (const key in tarifa) {
        const el = document.getElementById(key);
        if (el) el.value = tarifa[key];
    }
    document.getElementById('modo_cobro').dispatchEvent(new Event('change')); // Disparar evento para actualizar UI
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hacer la función global para que el onclick funcione
window.editarTarifa = editarTarifa;

function showToast(title, message, type) {
    const container = document.getElementById('toastContainer');
    const id = 't_' + Date.now();
    const typeClass = type==='success' ? 'toast-success' : type==='warning' ? 'toast-warning' : type==='info' ? 'toast-info' : 'toast-error';
    const el = document.createElement('div');
    el.className = `toast align-items-center toast-custom ${typeClass}`;
    el.id = id;
    el.role = 'alert';
    el.ariaLive = 'assertive';
    el.ariaAtomic = 'true';
    el.innerHTML = `
      <div class="toast-header">
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${message}</div>
    `;
    container.appendChild(el);
    const toast = new bootstrap.Toast(el, { delay: 3500 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

function fmt(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);
}
