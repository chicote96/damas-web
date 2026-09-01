(function () {
    let state;
    let currentTab = 'dashboard';
    let tabsScrollLeft = 0;

    const tabs = [
        ['dashboard', 'Dashboard', 'fa-chart-line'],
        ['cobradores', 'Cobradores', 'fa-users'],
        ['metas', 'Metas', 'fa-bullseye'],
        ['avances', 'Avances', 'fa-calendar-plus'],
        ['notas', 'Notas', 'fa-note-sticky'],
        ['buzon', 'Buzon', 'fa-inbox'],
        ['pizarra', 'Pizarra', 'fa-chalkboard'],
        ['logros', 'Logros', 'fa-medal'],
        ['premios', 'Premios', 'fa-trophy'],
        ['frase', 'Frase', 'fa-quote-left'],
        ['ranking', 'Ranking', 'fa-ranking-star'],
        ['historico', 'Historico', 'fa-clock-rotate-left']
    ];

    const $ = (id) => document.getElementById(id);
    const h = (v) => DamasPro.escapeHtml(v);

    function avatar(c, size = 'w-10 h-10') {
        if (c.profile_image_url) {
            return `<img src="${c.profile_image_url}" alt="${h(c.nombre)}" class="${size} rounded-full object-cover border border-brand-gray-dark">`;
        }
        return `<div class="${size} rounded-full bg-brand-blue/10 text-brand-blue font-bold flex items-center justify-center border border-brand-blue/20">${h(DamasPro.initials(c.nickname || c.nombre))}</div>`;
    }

    function progressBar(percent) {
        return `<div class="h-2.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-brand-green rounded-full" style="width:${DamasPro.visualPct(percent)}%"></div></div>`;
    }

    function ranking() {
        return state.cobradores
            .map(c => DamasPro.resumenCobrador(state, c.id))
            .sort((a, b) => b.cumplimientoGeneral - a.cumplimientoGeneral);
    }

    function renderShell(adminName) {
        const app = $('admin-app');
        const unreadBuzon = adminUnreadMessages();
        app.innerHTML = `
            <div class="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <p class="text-brand-blue text-xs font-bold uppercase tracking-widest">Panel Admin</p>
                    <h2 class="text-3xl font-banco font-bold text-brand-text tracking-wide mt-1">Gestion Cobrador PRO</h2>
                    <p class="text-brand-text/50 text-sm mt-1">Sesion: ${h(adminName)}. Datos sincronizados con el panel compartido.</p>
                </div>
                <a href="cobrador-pro.html" class="inline-flex items-center justify-center gap-2 bg-brand-dark text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-brand-dark/90">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Cobrador PRO
                </a>
            </div>
            <div id="admin-tabs" class="flex gap-2 overflow-x-auto border-b border-brand-gray-dark mb-6">
                ${tabs.map(([id, label, icon]) => `
                    <button data-tab="${id}" class="admin-tab shrink-0 pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 ${currentTab === id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-brand-text/40 hover:text-brand-text'} ${id === 'buzon' ? 'bg-brand-blue/10 text-brand-blue rounded-t-xl px-3 shadow-sm' : ''}">
                        <i class="fa-solid ${icon}"></i>${label}${id === 'buzon' && unreadBuzon ? `<span class="min-w-5 h-5 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center px-1">${unreadBuzon > 9 ? '9+' : unreadBuzon}</span>` : ''}
                    </button>
                `).join('')}
            </div>
            <div id="admin-view"></div>
        `;
        const tabsEl = $('admin-tabs');
        tabsEl.scrollLeft = tabsScrollLeft;
        tabsEl.addEventListener('scroll', () => {
            tabsScrollLeft = tabsEl.scrollLeft;
        }, { passive: true });
        app.querySelectorAll('.admin-tab').forEach(btn => btn.addEventListener('click', () => {
            tabsScrollLeft = tabsEl.scrollLeft;
            currentTab = btn.dataset.tab;
            renderShell(adminName);
            renderView();
            requestAnimationFrame(() => {
                const newTabs = $('admin-tabs');
                if (newTabs) newTabs.scrollLeft = tabsScrollLeft;
            });
        }));
    }

    function adminUnreadMessages() {
        return (state?.mensajes || []).filter(m => m.recipient_type === 'admin' && !m.read).length;
    }

    function renderView() {
        if (currentTab === 'dashboard') return renderDashboard();
        if (currentTab === 'cobradores') return renderCobradores();
        if (currentTab === 'metas') return renderMetas();
        if (currentTab === 'avances') return renderAvances();
        if (currentTab === 'notas') return renderNotas();
        if (currentTab === 'buzon') return renderBuzon();
        if (currentTab === 'pizarra') return renderPizarra();
        if (currentTab === 'logros') return renderLogros();
        if (currentTab === 'premios') return renderPremios();
        if (currentTab === 'frase') return renderFrase();
        if (currentTab === 'ranking') return renderRanking();
        if (currentTab === 'historico') return renderHistorico();
    }

    function stat(label, value, icon) {
        return `<div class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
                <p class="text-xs uppercase tracking-widest text-brand-text/40 font-bold">${label}</p>
                <i class="fa-solid ${icon} text-brand-blue"></i>
            </div>
            <p class="text-2xl font-heading font-bold text-brand-text mt-2">${value}</p>
        </div>`;
    }

    function renderDashboard() {
        DamasPro.recomputeUnlocks(state);
        const week = DamasPro.activeWeek(state);
        const active = state.cobradores.filter(c => c.estado === 'activo').length;
        const unlocked = (state.premios_cobradores || []).filter(p => p.fecha_inicio_periodo === week.start).length;
        const top = ranking()[0];
        $('admin-view').innerHTML = `
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${stat('Cobradores activos', active, 'fa-users')}
                ${stat('Premios otorgados esta semana', unlocked, 'fa-trophy')}
                ${stat('Frase activa', DamasPro.activePhrase(state) ? 'Si' : 'No', 'fa-quote-left')}
                ${stat('Lider semanal', top ? h(DamasPro.displayName(top.cobrador)) : '-', 'fa-ranking-star')}
            </div>
            <div class="grid lg:grid-cols-3 gap-5">
                <section class="lg:col-span-2 bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Resumen semanal</h3>
                    <div class="space-y-4">${ranking().map(r => rowResumen(r)).join('') || empty('No hay cobradores.')}</div>
                </section>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Acciones rapidas</h3>
                    <div class="grid gap-2">
                        <button data-jump="cobradores" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Crear cobrador</button>
                        <button data-jump="avances" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Agregar avance diario</button>
                        <button data-jump="notas" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Crear nota privada</button>
                        <button data-jump="buzon" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Abrir buzon</button>
                        <button data-jump="pizarra" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Pizarra semanal</button>
                        <button data-jump="logros" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Crear logro</button>
                        <button data-jump="premios" class="quick-btn text-left rounded-xl border border-brand-gray-dark p-3 hover:bg-brand-gray">Crear premio</button>
                    </div>
                </section>
            </div>
        `;
        document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => {
            currentTab = btn.dataset.jump;
            DamasAdmin.render();
        }));
    }

    function rowResumen(r) {
        const c = r.cobrador;
        return `<div class="rounded-xl border border-brand-gray-dark p-4">
            <div class="flex items-center gap-3">
                ${avatar(c)}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div>
                            <p class="font-bold text-brand-text truncate">${h(DamasPro.displayName(c))}</p>
                            <p class="text-xs text-brand-text/40">${h(c.username)} - ${h(c.estado)}</p>
                        </div>
                        <p class="font-heading font-bold text-brand-green">${Math.round(r.cumplimientoGeneral)}%</p>
                    </div>
                    ${progressBar(r.cumplimientoGeneral)}
                    <p class="text-xs text-brand-text/50 mt-2">${DamasPro.estadoCumplimiento(r.cumplimientoGeneral)}</p>
                </div>
            </div>
        </div>`;
    }

    function options(selected = '') {
        return state.cobradores.map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${h(c.nombre)} (${h(c.username)})</option>`).join('');
    }

    function renderCobradores() {
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-cobrador" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Crear cobrador</h3>
                    <input name="nombre" class="field-input" placeholder="Nombre completo" required>
                    <input name="username" class="field-input" placeholder="Usuario de acceso" required>
                    <input name="telefono" class="field-input" placeholder="Telefono">
                    <input name="pin" class="field-input" placeholder="PIN de 4 a 6 digitos" inputmode="numeric" required>
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Crear usuario</button>
                    <p class="text-xs text-brand-text/40">El PIN se guarda hasheado con Web Crypto en localStorage.</p>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Usuarios cobradores</h3>
                    <table class="w-full text-sm">
                        <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2">Cobrador</th><th>Usuario</th><th>Estado</th><th>Ultimo acceso</th><th>Acciones</th></tr></thead>
                        <tbody>${state.cobradores.map(c => `<tr class="border-b last:border-0">
                            <td class="py-3"><div class="flex items-center gap-3">${avatar(c, 'w-9 h-9')}<div><p class="font-bold">${h(c.nombre)}</p><p class="text-xs text-brand-text/40">${h(c.nickname || 'Sin nickname')}</p></div></div></td>
                            <td>${h(c.username)}</td><td>${h(c.estado)}</td><td>${h(c.last_login_at || '-')}</td>
                            <td class="flex flex-wrap gap-2 py-3">
                                <button data-profile="${c.id}" class="profile-btn px-3 py-1.5 rounded-lg bg-brand-green text-white text-xs font-bold">Ver perfil</button>
                                <button data-toggle="${c.id}" class="toggle-btn px-3 py-1.5 rounded-lg bg-brand-gray text-xs font-bold">${c.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
                                <button data-pin="${c.id}" class="pin-btn px-3 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-bold">Cambiar PIN</button>
                            </td>
                        </tr>`).join('')}</tbody>
                    </table>
                </section>
            </div>`;
        $('form-cobrador').addEventListener('submit', createCobrador);
        document.querySelectorAll('.profile-btn').forEach(btn => btn.addEventListener('click', openAdminProfile));
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.addEventListener('click', toggleCobrador));
        document.querySelectorAll('.pin-btn').forEach(btn => btn.addEventListener('click', changePin));
    }

    async function createCobrador(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const pin = String(data.pin || '');
        if (!/^\d{4,6}$/.test(pin)) return alert('El PIN debe tener entre 4 y 6 digitos.');
        if (state.cobradores.some(c => c.username.toLowerCase() === data.username.toLowerCase())) return alert('Ese usuario ya existe.');
        state.cobradores.push({ id: DamasPro.uid('cob'), nombre: data.nombre.trim(), username: data.username.trim().toLowerCase(), telefono: data.telefono.trim(), nickname: '', profile_image_url: '', estado: 'activo', pin_hash: await DamasPro.hashPin(pin), role: 'cobrador', last_login_at: null, created_at: new Date().toISOString() });
        DamasPro.save(state);
        renderView();
    }

    function toggleCobrador(e) {
        const c = state.cobradores.find(x => x.id === e.target.dataset.toggle);
        c.estado = c.estado === 'activo' ? 'inactivo' : 'activo';
        DamasPro.save(state);
        renderView();
    }

    async function changePin(e) {
        const pin = prompt('Nuevo PIN de 4 a 6 digitos');
        if (pin === null) return;
        if (!/^\d{4,6}$/.test(pin)) return alert('PIN invalido.');
        const c = state.cobradores.find(x => x.id === e.target.dataset.pin);
        c.pin_hash = await DamasPro.hashPin(pin);
        DamasPro.save(state);
        alert('PIN actualizado.');
    }

    function renderMetas() {
        const week = DamasPro.activeWeek(state);
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-meta" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Crear meta manual</h3>
                    ${fieldLabel('Cobrador', `<select name="cobrador_id" class="field-input">${options()}</select>`)}
                    ${fieldLabel('Fecha de inicio', `<input name="fecha_inicio_semana" class="field-input" type="date" value="${week.start}" required>`)}
                    ${fieldLabel('Fecha final', `<input name="fecha_fin_semana" class="field-input" type="date" value="${week.end}" required>`)}
                    ${fieldLabel('Meta creditos nuevos', '<input name="meta_creditos_nuevos" class="field-input" type="number" min="0" placeholder="Ej. 10" required>')}
                    ${fieldLabel('Meta renovaciones', '<input name="meta_renovaciones" class="field-input" type="number" min="0" placeholder="Ej. 8" required>')}
                    ${fieldLabel('Meta recaudo', '<input name="meta_recaudo" class="field-input" type="number" min="0" placeholder="Ej. 8000000" required>')}
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Guardar meta</button>
                    <p class="text-xs text-brand-text/40">Al guardar, se activa esta meta y se desactivan las metas anteriores del mismo cobrador.</p>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Metas guardadas</h3>
                    <div class="grid md:grid-cols-2 gap-3">${state.metas.slice().reverse().map(metaCard).join('') || empty('No hay metas creadas.')}</div>
                </section>
            </div>`;
        $('form-meta').addEventListener('submit', saveMeta);
        document.querySelectorAll('.meta-delete').forEach(btn => btn.addEventListener('click', deleteMeta));
    }

    function saveMeta(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        if (data.fecha_fin_semana < data.fecha_inicio_semana) return alert('La fecha final no puede ser menor que la fecha de inicio.');
        state.metas.filter(m => m.cobrador_id === data.cobrador_id).forEach(m => m.activa = false);
        state.metas.push({ id: DamasPro.uid('meta'), cobrador_id: data.cobrador_id, fecha_inicio_semana: data.fecha_inicio_semana, fecha_fin_semana: data.fecha_fin_semana, meta_creditos_nuevos: Number(data.meta_creditos_nuevos), meta_renovaciones: Number(data.meta_renovaciones), meta_recaudo: Number(data.meta_recaudo), activa: true, created_by: 'admin_mauricio', created_at: new Date().toISOString() });
        DamasPro.recomputeUnlocks(state);
        DamasPro.save(state);
        renderView();
    }

    function metaCard(m) {
        const c = state.cobradores.find(x => x.id === m.cobrador_id) || {};
        return `<div class="rounded-xl border ${m.activa ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-bold">${h(c.nombre || 'Cobrador')}</p>
                    <p class="text-xs text-brand-text/40 mt-1">${h(DamasPro.date(m.fecha_inicio_semana))} a ${h(DamasPro.date(m.fecha_fin_semana))}</p>
                </div>
                <span class="text-xs rounded-full px-2 py-1 ${m.activa ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${m.activa ? 'Activa' : 'Inactiva'}</span>
            </div>
            <p class="text-sm text-brand-text/60 mt-3">Creditos: ${m.meta_creditos_nuevos || 0}<br>Renovaciones: ${m.meta_renovaciones || 0}<br>Recaudo: ${DamasPro.money(m.meta_recaudo || 0)}</p>
            <button data-meta="${m.id}" class="meta-delete mt-4 rounded-lg bg-red-50 text-red-500 px-3 py-2 text-xs font-bold">Eliminar meta</button>
        </div>`;
    }

    function deleteMeta(e) {
        const id = e.target.dataset.meta;
        const meta = state.metas.find(m => m.id === id);
        if (!meta) return;
        if (!confirm('Eliminar esta meta? Podras crear una nueva manualmente.')) return;
        state.metas = state.metas.filter(m => m.id !== id);
        if (meta.activa) {
            const lastForCollector = state.metas.filter(m => m.cobrador_id === meta.cobrador_id).slice(-1)[0];
            if (lastForCollector) lastForCollector.activa = true;
        }
        DamasPro.recomputeUnlocks(state);
        DamasPro.save(state);
        renderView();
    }

    function renderAvances() {
        const week = DamasPro.activeWeek(state);
        const latestAvanceDate = latestAvanceFecha();
        const selectedDate = sessionStorage.getItem('admin_avances_filter_date') || latestAvanceDate;
        const filteredAvances = state.avances.filter(a => a.fecha === selectedDate);
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-avance" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 id="avance-form-title" class="font-heading font-bold text-brand-text">Agregar avance diario</h3>
                    <p class="text-xs text-brand-text/45">Semana activa: ${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}. Los avances nuevos cuentan para esta semana hasta que la cierres.</p>
                    <input name="id" type="hidden">
                    ${fieldLabel('Cobrador', 'Selecciona a quien le vas a sumar este avance.', `<select name="cobrador_id" class="field-input">${options()}</select>`)}
                    ${fieldLabel('Fecha del avance', 'Dia exacto en que se hizo la gestion.', `<input name="fecha" class="field-input" type="date" value="${new Date().toISOString().slice(0,10)}" required>`)}
                    ${fieldLabel('Creditos nuevos a agregar', 'Cantidad de creditos nuevos que se suman a este cobrador.', `<input name="creditos_nuevos" class="field-input text-base font-semibold" type="number" min="0" placeholder="Cuantos creditos nuevos vas a agregar" value="">`)}
                    ${fieldLabel('Renovaciones a agregar', 'Cantidad de renovaciones que se suman a este cobrador.', `<input name="renovaciones" class="field-input text-base font-semibold" type="number" min="0" placeholder="Cuantas renovaciones vas a agregar" value="">`)}
                    ${fieldLabel('Recaudo a agregar (COP)', 'Dinero recaudado que se suma a este cobrador.', `<input name="recaudo_dia" class="field-input text-base font-semibold" type="text" inputmode="numeric" placeholder="$ 0" value="">`)}
                    <div class="rounded-xl bg-brand-gray border border-brand-gray-dark p-4 space-y-2">
                        <p class="text-xs uppercase tracking-widest text-brand-text/45 font-bold">Resumen de lo que vas a agregar</p>
                        <div class="grid gap-2 text-sm">
                            <div class="flex items-center justify-between gap-3"><span class="font-bold text-brand-text/70">Creditos nuevos</span><b id="avance-preview-creditos" class="text-brand-text">Sin agregar</b></div>
                            <div class="flex items-center justify-between gap-3"><span class="font-bold text-brand-text/70">Renovaciones</span><b id="avance-preview-renovaciones" class="text-brand-text">Sin agregar</b></div>
                            <div class="flex items-center justify-between gap-3"><span class="font-bold text-brand-text/70">Recaudo</span><b id="avance-preview-recaudo" class="text-brand-text">Sin agregar</b></div>
                        </div>
                    </div>
                    ${fieldLabel('Observacion interna opcional', 'Nota administrativa. No la ve el cobrador.', `<textarea name="observacion" class="field-input resize-none" rows="3" placeholder="Ej. Buen cierre de ruta"></textarea>`)}
                    <div class="grid grid-cols-2 gap-2">
                        <button id="avance-submit" class="bg-brand-green text-white rounded-xl py-3 font-bold">Guardar avance</button>
                        <button id="avance-cancel" type="button" class="hidden bg-brand-gray text-brand-text rounded-xl py-3 font-bold">Cancelar</button>
                    </div>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                        <div>
                            <h3 class="font-heading font-bold text-brand-text">Historial de avances</h3>
                            <p class="text-xs text-brand-text/45 mt-1">Filtrado por fecha para evitar confusiones.</p>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-end gap-2">
                            ${fieldLabel('Fecha', `<input id="avance-filter-date" class="field-input sm:w-44" type="date" value="${selectedDate}">`)}
                            <button id="reset-progress" type="button" class="border border-red-200 text-red-500 rounded-xl px-4 py-3 text-sm font-bold hover:bg-red-50">
                                Cerrar semana
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-brand-text/40 mb-4">Cierra la semana activa, archiva el resumen y abre la siguiente. Los premios y logros ganados se conservan.</p>
                    <div class="space-y-2">${filteredAvances.slice().reverse().map(a => {
                        const c = state.cobradores.find(x => x.id === a.cobrador_id) || {};
                        const avanceActions = `<div class="mt-3 flex gap-2"><button data-avance-edit="${a.id}" class="avance-edit rounded-lg bg-brand-blue text-white px-3 py-2 text-xs font-bold">Editar</button><button data-avance-delete="${a.id}" class="avance-delete rounded-lg bg-red-50 text-red-500 px-3 py-2 text-xs font-bold">Eliminar</button></div>`;
                        return `<div class="rounded-xl border border-brand-gray-dark p-3 text-sm">
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <b>${h(c.nombre)}</b>
                                <span class="text-xs font-bold text-brand-text/40">${h(DamasPro.date(a.fecha))}</span>
                            </div>
                            <div class="grid sm:grid-cols-3 gap-2 mt-3">
                                ${avanceMetric('Creditos nuevos agregados', a.creditos_nuevos || 0)}
                                ${avanceMetric('Renovaciones agregadas', a.renovaciones || 0)}
                                ${avanceMetric('Recaudo agregado', DamasPro.money(a.recaudo_dia || 0))}
                            </div>
                            ${a.observacion_admin_opcional ? `<p class="text-xs text-brand-text/40 mt-3">${h(a.observacion_admin_opcional)}</p>` : ''}
                            ${avanceActions}
                        </div>`;
                    }).join('') || empty('No hay avances registrados para esta fecha.')}</div>
                </section>
            </div>`;
        $('form-avance').addEventListener('submit', saveAvance);
        $('avance-filter-date').addEventListener('change', (e) => {
            sessionStorage.setItem('admin_avances_filter_date', e.target.value);
            renderAvances();
        });
        $('reset-progress').addEventListener('click', resetWeeklyProgress);
        $('avance-cancel').addEventListener('click', clearAvanceForm);
        setupAvancePreview();
        document.querySelectorAll('.avance-edit').forEach(btn => btn.addEventListener('click', editAvance));
        document.querySelectorAll('.avance-delete').forEach(btn => btn.addEventListener('click', deleteAvance));
    }

    async function saveAvance(e) {
        e.preventDefault();
        const form = e.target;
        const submit = $('avance-submit');
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Guardando...';
        }
        try {
            const data = Object.fromEntries(new FormData(form).entries());
            const advanceWeek = DamasPro.weekRange(`${data.fecha}T12:00:00`);
            const payload = { cobrador_id: data.cobrador_id, fecha: data.fecha, creditos_nuevos: Number(data.creditos_nuevos || 0), renovaciones: Number(data.renovaciones || 0), recaudo_dia: parseMoneyInput(data.recaudo_dia), observacion_admin_opcional: data.observacion.trim(), updated_at: new Date().toISOString() };
            if (data.id) {
                const avance = state.avances.find(a => a.id === data.id);
                if (!avance) return alert('No se encontro el avance para editar.');
                payload.fecha_inicio_semana = advanceWeek.start;
                payload.fecha_fin_semana = advanceWeek.end;
                Object.assign(avance, payload);
            } else {
                state.avances.push({ id: DamasPro.uid('av'), ...payload, fecha_inicio_semana: advanceWeek.start, fecha_fin_semana: advanceWeek.end, created_by: 'admin_mauricio', created_at: new Date().toISOString() });
            }
            DamasPro.recomputeUnlocks(state);
            const saved = await DamasPro.save(state);
            if (!saved) throw new Error('No se pudo guardar en el servidor. Revisa la conexion e intenta de nuevo.');
            sessionStorage.setItem('admin_avances_filter_date', payload.fecha);
            alert('Avance guardado correctamente.');
            renderView();
        } catch (err) {
            alert(err.message || 'No se pudo guardar el avance.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = form.elements.id.value ? 'Guardar cambios' : 'Guardar avance';
            }
        }
    }

    function editAvance(e) {
        const avance = state.avances.find(a => a.id === e.target.dataset.avanceEdit);
        const form = $('form-avance');
        form.elements.id.value = avance.id;
        form.cobrador_id.value = avance.cobrador_id;
        form.fecha.value = avance.fecha;
        form.creditos_nuevos.value = avance.creditos_nuevos || 0;
        form.renovaciones.value = avance.renovaciones || 0;
        form.recaudo_dia.value = formatMoneyInput(avance.recaudo_dia || 0);
        form.observacion.value = avance.observacion_admin_opcional || '';
        $('avance-form-title').textContent = 'Editar avance diario';
        $('avance-submit').textContent = 'Guardar cambios';
        $('avance-cancel').classList.remove('hidden');
        updateAvancePreview();
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function deleteAvance(e) {
        if (!confirm('Eliminar este avance diario?')) return;
        state.avances = state.avances.filter(a => a.id !== e.target.dataset.avanceDelete);
        DamasPro.recomputeUnlocks(state);
        DamasPro.save(state);
        renderView();
    }

    async function resetWeeklyProgress() {
        const week = DamasPro.activeWeek(state);
        if (!confirm(`Cerrar la semana activa (${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}) y abrir la siguiente? Se archivara el resumen antes de borrar avances. Premios y logros ganados se conservan.`)) return;
        const stateBeforeClose = structuredClone(state);
        const result = DamasPro.resetWeeklyProgress(state);
        const saved = await DamasPro.persistWeeklyClosure(state, result);
        if (!saved) {
            state = stateBeforeClose;
            return alert('No se pudo cerrar la semana en el servidor. No se aplicaron cambios; revisa la conexion e intenta de nuevo.');
        }
        sessionStorage.setItem('admin_avances_filter_date', new Date().toISOString().slice(0, 10));
        const next = DamasPro.activeWeek(state);
        alert(`Semana cerrada. Avances eliminados: ${result.removed}. Nueva semana activa: ${DamasPro.date(next.start)} a ${DamasPro.date(next.end)}.`);
        renderView();
    }

    function clearAvanceForm() {
        const form = $('form-avance');
        form.reset();
        form.elements.id.value = '';
        form.fecha.value = new Date().toISOString().slice(0, 10);
        $('avance-form-title').textContent = 'Agregar avance diario';
        $('avance-submit').textContent = 'Guardar avance';
        $('avance-cancel').classList.add('hidden');
        updateAvancePreview();
    }

    function latestAvanceFecha() {
        return state.avances
            .map(a => a.fecha)
            .filter(Boolean)
            .sort((a, b) => String(b).localeCompare(String(a)))[0] || new Date().toISOString().slice(0,10);
    }

    function renderNotas() {
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-nota" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Pizarron de notas privadas</h3>
                    <select name="cobrador_id" class="field-input">${options()}</select>
                    <input name="titulo" class="field-input" placeholder="Titulo" required>
                    <select name="prioridad" class="field-input"><option>Normal</option><option>Importante</option><option>Urgente</option></select>
                    <textarea name="mensaje" class="field-input resize-none" rows="4" placeholder="Mensaje privado" required></textarea>
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Crear nota</button>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Notas creadas</h3>
                    <div class="space-y-3">${state.notas.slice().reverse().map(n => {
                        const c = state.cobradores.find(x => x.id === n.cobrador_id) || {};
                        return `<div class="rounded-xl border border-brand-gray-dark p-4"><div class="flex justify-between gap-3"><b>${h(n.titulo)}</b><span class="text-xs text-brand-text/40">${h(n.prioridad)} - ${n.leido ? 'Leida' : 'No leida'}</span></div><p class="text-sm text-brand-text/60 mt-1">${h(c.nombre)} - ${h(n.mensaje)}</p></div>`;
                    }).join('') || empty('No hay notas.')}</div>
                </section>
            </div>`;
        $('form-nota').addEventListener('submit', saveNota);
    }

    function saveNota(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        state.notas.push({ id: DamasPro.uid('nota'), cobrador_id: data.cobrador_id, admin_id: 'admin_mauricio', titulo: data.titulo.trim(), mensaje: data.mensaje.trim(), prioridad: data.prioridad, leido: false, fecha_lectura: null, created_at: new Date().toISOString() });
        DamasPro.save(state);
        renderView();
    }

    function renderBuzon() {
        const messages = adminMessages();
        const conversations = adminConversations(messages);
        const unread = messages.filter(m => m.recipient_type === 'admin' && !m.read).length;
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[380px_1fr] gap-5">
                <form id="form-message" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Enviar mensaje</h3>
                    ${fieldLabel('Para', `<select name="cobrador_id" class="field-input">${options()}</select>`)}
                    ${fieldLabel('Titulo', '<input name="title" class="field-input" placeholder="Asunto del mensaje" required>')}
                    ${fieldLabel('Mensaje', '<textarea name="body" class="field-input resize-none" rows="5" placeholder="Escribe el mensaje" required></textarea>')}
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Enviar al buzon</button>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <h3 class="font-heading font-bold text-brand-text">Buzon admin</h3>
                        <span class="text-xs rounded-full px-3 py-1 font-bold ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread} sin leer</span>
                    </div>
                    <div class="space-y-4">${conversations.map(adminConversationCard).join('') || empty('No hay mensajes en el buzon.')}</div>
                </section>
            </div>`;
        $('form-message').addEventListener('submit', sendAdminMessage);
        document.querySelectorAll('.admin-message-read').forEach(btn => btn.addEventListener('click', markAdminMessageRead));
        document.querySelectorAll('.admin-message-delete').forEach(btn => btn.addEventListener('click', deleteMessage));
        document.querySelectorAll('.admin-reply-form').forEach(form => form.addEventListener('submit', sendAdminReply));
    }

    function adminMessages() {
        return (state.mensajes || [])
            .filter(m => m.recipient_type === 'admin' || m.sender_type === 'admin')
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    function adminConversations(messages) {
        const groups = new Map();
        messages.forEach(m => {
            const key = m.thread_id || m.id;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(m);
        });
        return Array.from(groups.entries()).map(([threadId, items]) => {
            const sorted = items.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
            return { threadId, messages: sorted, latest: sorted[sorted.length - 1] };
        }).sort((a, b) => String(b.latest.created_at || '').localeCompare(String(a.latest.created_at || '')));
    }

    function adminConversationCard(conversation) {
        const unread = conversation.messages.some(m => m.recipient_type === 'admin' && !m.read);
        const latestIncoming = conversation.messages.slice().reverse().find(m => m.sender_type !== 'admin');
        const target = latestIncoming
            ? { id: latestIncoming.sender_id, type: latestIncoming.sender_type, name: latestIncoming.sender_name }
            : { id: conversation.latest.recipient_id, type: conversation.latest.recipient_type, name: conversation.latest.recipient_name };
        return `<article class="rounded-xl border ${unread ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 class="font-bold text-brand-text">${h(conversation.latest.title)}</h4>
                    <p class="text-xs text-brand-text/40 mt-1">Conversacion con ${h(target.name || 'Usuario')} - ${conversation.messages.length} mensajes</p>
                </div>
                <span class="shrink-0 text-xs rounded-full px-2 py-1 ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread ? 'Nuevo' : 'Leido'}</span>
            </div>
            <div class="space-y-2">${conversation.messages.map(adminConversationMessage).join('')}</div>
            <form class="admin-reply-form mt-4 flex flex-col sm:flex-row gap-2" data-thread="${conversation.threadId}" data-recipient-type="${h(target.type)}" data-recipient-id="${h(target.id)}" data-recipient-name="${h(target.name || '')}">
                <input name="body" class="field-input" placeholder="Responder esta conversacion" required>
                <button class="shrink-0 bg-brand-blue text-white rounded-xl px-4 py-2 font-bold">Responder</button>
            </form>
            <div class="mt-3 flex flex-wrap gap-2">
                ${unread ? `<button data-message="${conversation.threadId}" class="admin-message-read text-brand-blue text-sm font-bold">Marcar conversacion como leida</button>` : ''}
                <button data-message-delete="${conversation.threadId}" class="admin-message-delete text-red-500 text-sm font-bold">Eliminar conversacion</button>
            </div>
        </article>`;
    }

    function adminConversationMessage(m) {
        const mine = m.sender_type === 'admin';
        return `<div class="rounded-lg ${mine ? 'bg-brand-blue/10' : 'bg-white'} border border-brand-gray-dark p-3">
            <p class="text-xs font-bold ${mine ? 'text-brand-blue' : 'text-brand-text/55'}">${mine ? 'Admin Mauricio' : h(m.sender_name || 'Cobrador')} - ${new Date(m.created_at).toLocaleString('es-CO')}</p>
            <p class="text-sm text-brand-text/75 mt-1 whitespace-pre-wrap">${h(m.body)}</p>
        </div>`;
    }

    function adminMessageCard(m) {
        const incoming = m.recipient_type === 'admin';
        const unread = incoming && !m.read;
        const meta = incoming ? `De ${h(m.sender_name || 'Cobrador')}` : `Para ${h(m.recipient_name || 'Cobrador')}`;
        return `<article class="rounded-xl border ${unread ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h4 class="font-bold text-brand-text">${h(m.title)}</h4>
                        <span class="text-[11px] rounded-full bg-brand-gray px-2 py-1 text-brand-text/55">${h(m.category || 'mensaje')}</span>
                    </div>
                    <p class="text-xs text-brand-text/40 mt-1">${meta} - ${new Date(m.created_at).toLocaleDateString('es-CO')}</p>
                </div>
                <span class="shrink-0 text-xs rounded-full px-2 py-1 ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread ? 'Nuevo' : incoming ? 'Leido' : 'Enviado'}</span>
            </div>
            <p class="text-sm text-brand-text/70 mt-3 whitespace-pre-wrap">${h(m.body)}</p>
            <div class="mt-3 flex flex-wrap gap-2">
                ${unread ? `<button data-message="${m.id}" class="admin-message-read text-brand-blue text-sm font-bold">Marcar como leido</button>` : ''}
                <button data-message-delete="${m.id}" class="admin-message-delete text-red-500 text-sm font-bold">Eliminar</button>
            </div>
        </article>`;
    }

    function sendAdminMessage(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const target = state.cobradores.find(c => c.id === data.cobrador_id);
        if (!target) return alert('Selecciona un cobrador valido.');
        DamasPro.addMessage(state, {
            sender_type: 'admin',
            sender_id: 'admin_mauricio',
            sender_name: 'Admin Mauricio',
            recipient_type: 'cobrador',
            recipient_id: target.id,
            recipient_name: DamasPro.displayName(target),
            title: data.title.trim(),
            body: data.body.trim(),
            category: 'mensaje'
        });
        DamasPro.save(state);
        renderView();
    }

    function markAdminMessageRead(e) {
        const threadId = e.target.dataset.message;
        const now = new Date().toISOString();
        (state.mensajes || []).forEach(m => {
            if ((m.thread_id || m.id) === threadId && m.recipient_type === 'admin') {
                m.read = true;
                m.read_at = now;
            }
        });
        DamasPro.save(state);
        renderView();
    }

    function deleteMessage(e) {
        if (!confirm('Eliminar esta conversacion del buzon?')) return;
        const threadId = e.target.dataset.messageDelete;
        state.mensajes = (state.mensajes || []).filter(m => (m.thread_id || m.id) !== threadId);
        DamasPro.save(state);
        renderView();
    }

    function sendAdminReply(e) {
        e.preventDefault();
        const form = e.target;
        const body = String(new FormData(form).get('body') || '').trim();
        if (!body) return;
        DamasPro.addMessage(state, {
            thread_id: form.dataset.thread,
            sender_type: 'admin',
            sender_id: 'admin_mauricio',
            sender_name: 'Admin Mauricio',
            recipient_type: form.dataset.recipientType,
            recipient_id: form.dataset.recipientId,
            recipient_name: form.dataset.recipientName,
            title: 'Respuesta',
            body,
            category: 'mensaje'
        });
        DamasPro.save(state);
        renderView();
    }

    function renderPizarra() {
        const week = DamasPro.activeWeek(state);
        const notes = pizarraNotasSemana();
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-pizarra" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Pizarra semanal publica</h3>
                    <p class="text-xs text-brand-text/45">Todo lo que escribas aqui sera visible para todos los cobradores.</p>
                    <input name="titulo" class="field-input" placeholder="Titulo corto" required>
                    <textarea name="mensaje" class="field-input resize-none" rows="5" placeholder="Escribe una nota para la pizarra" required></textarea>
                    <button class="w-full bg-brand-green text-white rounded-xl py-3 font-bold">Publicar en pizarra</button>
                    <button id="clear-pizarra" type="button" class="w-full border border-red-200 text-red-500 rounded-xl py-3 font-bold hover:bg-red-50">Limpiar pizarra semanal</button>
                    <p class="text-xs text-brand-text/40">Semana actual: ${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}</p>
                </form>
                ${pizarraBoard(notes, true)}
            </div>`;
        $('form-pizarra').addEventListener('submit', savePizarraNotaAdmin);
        $('clear-pizarra').addEventListener('click', clearPizarraSemana);
        document.querySelectorAll('.pizarra-delete').forEach(btn => btn.addEventListener('click', deletePizarraNota));
    }

    function pizarraBoard(notes, canDelete) {
        return `<section class="rounded-xl p-5 shadow-sm border-4 border-[#7b4f2a]" style="background:#155f3b; box-shadow: inset 0 0 0 2px rgba(255,255,255,.08);">
            <div class="flex items-center justify-between gap-3 mb-5">
                <h3 class="font-heading font-bold text-white">Pizarra de la semana</h3>
                <span class="text-xs text-white/60 font-bold">${notes.length} notas</span>
            </div>
            <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${notes.map(n => pizarraNoteCard(n, canDelete)).join('') || `<p class="text-white/60 text-sm py-8 text-center md:col-span-2 xl:col-span-3">La pizarra esta vacia.</p>`}</div>
        </section>`;
    }

    function pizarraNoteCard(n, canDelete) {
        const color = pizarraAuthorColor(n);
        return `<article class="rounded-lg text-brand-text p-4 shadow-md rotate-[-.5deg] border-l-4" style="background:${color.bg}; border-left-color:${color.border};">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-heading font-bold">${h(n.titulo)}</h4>
                    <p class="text-xs text-brand-text/45 mt-1"><span class="inline-block w-2 h-2 rounded-full mr-1" style="background:${color.border};"></span>${h(n.autor_nombre || 'Admin')} - ${new Date(n.created_at).toLocaleDateString('es-CO')}</p>
                </div>
                ${canDelete ? `<button data-pizarra-delete="${n.id}" class="pizarra-delete text-red-500 text-xs font-bold">Eliminar</button>` : ''}
            </div>
            <p class="text-sm text-brand-text/75 mt-3 whitespace-pre-wrap">${h(n.mensaje)}</p>
        </article>`;
    }

    function pizarraNotasSemana() {
        const week = DamasPro.activeWeek(state);
        return (state.pizarra_notas || [])
            .filter(n => n.fecha >= week.start && n.fecha <= week.end)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    function pizarraAuthorColor(n) {
        const colors = [
            { bg: '#f8f3cf', border: '#d9a441' },
            { bg: '#dbeafe', border: '#3891CB' },
            { bg: '#dcfce7', border: '#059669' },
            { bg: '#fee2e2', border: '#ef4444' },
            { bg: '#f3e8ff', border: '#8b5cf6' },
            { bg: '#ffedd5', border: '#f97316' }
        ];
        if (n.autor_tipo === 'admin') return { bg: '#f8f3cf', border: '#C8A85C' };
        const key = String(n.autor_id || n.autor_nombre || '');
        const index = Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length;
        return colors[index];
    }

    function savePizarraNotaAdmin(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        state.pizarra_notas.push({ id: DamasPro.uid('pz'), titulo: data.titulo.trim(), mensaje: data.mensaje.trim(), autor_tipo: 'admin', autor_id: 'admin_mauricio', autor_nombre: 'Admin Mauricio', fecha: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() });
        DamasPro.save(state);
        renderView();
    }

    function deletePizarraNota(e) {
        if (!confirm('Eliminar esta nota de la pizarra?')) return;
        state.pizarra_notas = (state.pizarra_notas || []).filter(n => n.id !== e.target.dataset.pizarraDelete);
        DamasPro.save(state);
        renderView();
    }

    function clearPizarraSemana() {
        if (!confirm('Limpiar todas las notas de la pizarra de esta semana?')) return;
        const week = DamasPro.activeWeek(state);
        state.pizarra_notas = (state.pizarra_notas || []).filter(n => n.fecha < week.start || n.fecha > week.end);
        DamasPro.save(state);
        renderView();
    }

    function renderLogros() {
        const week = DamasPro.activeWeek(state);
        const weekAwards = currentWeekLogroAwards();
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[380px_1fr] gap-5">
                <div class="space-y-5">
                    <form id="form-logro" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                        <h3 id="logro-form-title" class="font-heading font-bold text-brand-text">Crear logro</h3>
                        <input name="id" type="hidden">
                        ${fieldLabel('Nombre del logro', '<input name="nombre" class="field-input" placeholder="Ej. Primer cierre" required>')}
                        ${fieldLabel('Descripcion breve', '<textarea name="descripcion" class="field-input resize-none" rows="3" placeholder="Explica que debe lograr el cobrador" required></textarea>')}
                        ${fieldLabel('Tipo de meta asociada', '<select name="tipo" class="field-input"><option value="creditos_nuevos">Creditos nuevos</option><option value="renovaciones">Renovaciones</option><option value="recaudo">Recaudo</option><option value="cumplimiento_general">Cumplimiento general</option></select>')}
                        ${fieldLabel('Valor objetivo', 'Numero que debe alcanzar para desbloquear el logro.', '<input name="valor_objetivo" class="field-input" type="number" min="0" placeholder="Ej. 5" required>')}
                        ${fieldLabel('Nivel del logro', '<select name="nivel" class="field-input"><option>Bronce</option><option>Plata</option><option>Oro</option><option>Diamante</option></select>')}
                        ${fieldLabel('Imagen personalizada', '<input name="imagen" class="field-input" type="file" accept="image/png,image/jpeg,image/webp">')}
                        <div class="grid grid-cols-2 gap-2">
                            <button id="logro-submit" class="bg-brand-blue text-white rounded-xl py-3 font-bold">Crear logro</button>
                            <button id="logro-cancel" type="button" class="hidden bg-brand-gray text-brand-text rounded-xl py-3 font-bold">Cancelar</button>
                        </div>
                    </form>
                    <form id="form-award-logro" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                        <h3 class="font-heading font-bold text-brand-text">Otorgar logro manual</h3>
                        ${fieldLabel('Cobrador', `<select name="cobrador_id" class="field-input">${options()}</select>`)}
                        ${fieldLabel('Logro', `<select name="logro_id" class="field-input">${(state.logros || []).map(l => `<option value="${l.id}">${h(l.nombre)} (${h(l.nivel)})</option>`).join('')}</select>`)}
                        <button class="w-full bg-brand-green text-white rounded-xl py-3 font-bold">Otorgar logro</button>
                        <p class="text-xs text-brand-text/40">Semana actual: ${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}.</p>
                    </form>
                </div>
                <div class="space-y-5">
                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                        <h3 class="font-heading font-bold text-brand-text mb-4">Ganadores de logros esta semana</h3>
                        ${logroWinnersTable(weekAwards)}
                    </section>
                    <section class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${(state.logros || []).map(logroAdminCard).join('') || empty('No hay logros creados.')}</section>
                </div>
            </div>`;
        $('form-logro').addEventListener('submit', saveLogro);
        $('logro-cancel').addEventListener('click', clearLogroForm);
        $('form-award-logro').addEventListener('submit', awardLogro);
        document.querySelectorAll('.logro-edit').forEach(btn => btn.addEventListener('click', editLogro));
        document.querySelectorAll('.logro-toggle').forEach(btn => btn.addEventListener('click', toggleLogro));
        document.querySelectorAll('.logro-delete').forEach(btn => btn.addEventListener('click', deleteLogro));
        document.querySelectorAll('.logro-revoke').forEach(btn => btn.addEventListener('click', revokeLogro));
    }

    function logroAdminCard(l) {
        return `<article class="bg-white border border-brand-gray-dark rounded-xl p-4 shadow-sm">
            <div class="aspect-[4/3] rounded-xl bg-brand-gray flex items-center justify-center overflow-hidden mb-3">${l.imagen_url ? `<img src="${l.imagen_url}" class="w-full h-full object-cover" alt="${h(l.nombre)}">` : `<i class="fa-solid ${h(l.icono || 'fa-medal')} text-4xl text-brand-gold"></i>`}</div>
            <div class="flex justify-between gap-3"><h3 class="font-heading font-bold">${h(l.nombre)}</h3><span class="text-xs font-bold text-brand-blue">${h(l.nivel)}</span></div>
            <p class="text-sm text-brand-text/60 mt-1">${h(l.descripcion)}</p>
            <p class="text-xs text-brand-text/40 mt-2">${h(l.tipo)} >= ${h(l.valor_objetivo)}</p>
            <p class="text-xs font-bold mt-2 ${l.activo ? 'text-brand-green' : 'text-brand-text/40'}">${l.activo ? 'Activo' : 'Inactivo'}</p>
            <div class="mt-3 flex flex-wrap gap-2">
                <button data-logro-edit="${l.id}" class="logro-edit rounded-lg bg-brand-blue text-white px-3 py-2 text-xs font-bold">Editar</button>
                <button data-logro-toggle="${l.id}" class="logro-toggle rounded-lg bg-brand-gray px-3 py-2 text-xs font-bold">${l.activo ? 'Desactivar' : 'Activar'}</button>
                <button data-logro-delete="${l.id}" class="logro-delete rounded-lg bg-red-50 text-red-500 px-3 py-2 text-xs font-bold">Eliminar</button>
            </div>
        </article>`;
    }

    async function saveLogro(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        let image = '';
        const file = fd.get('imagen');
        if (file && file.size) {
            try { image = await DamasPro.fileToDataUrl(file); } catch (err) { return alert(err.message); }
        }
        const id = fd.get('id');
        const payload = {
            nombre: fd.get('nombre').trim(),
            descripcion: fd.get('descripcion').trim(),
            tipo: fd.get('tipo'),
            valor_objetivo: Number(fd.get('valor_objetivo') || 0),
            nivel: fd.get('nivel'),
            icono: 'fa-medal',
            updated_at: new Date().toISOString()
        };
        if (id) {
            const logro = state.logros.find(l => l.id === id);
            Object.assign(logro, payload);
            if (image) logro.imagen_url = image;
        } else {
            state.logros.push({ id: DamasPro.uid('logro'), ...payload, imagen_url: image, activo: true, created_by: 'admin_mauricio', created_at: new Date().toISOString() });
        }
        DamasPro.recomputeUnlocks(state);
        DamasPro.save(state);
        renderView();
    }

    function editLogro(e) {
        const l = state.logros.find(x => x.id === e.target.dataset.logroEdit);
        const form = $('form-logro');
        form.elements.id.value = l.id;
        form.nombre.value = l.nombre || '';
        form.descripcion.value = l.descripcion || '';
        form.tipo.value = l.tipo || 'creditos_nuevos';
        form.valor_objetivo.value = l.valor_objetivo || 0;
        form.nivel.value = l.nivel || 'Bronce';
        $('logro-form-title').textContent = 'Editar logro';
        $('logro-submit').textContent = 'Guardar cambios';
        $('logro-cancel').classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearLogroForm() {
        const form = $('form-logro');
        form.reset();
        form.elements.id.value = '';
        $('logro-form-title').textContent = 'Crear logro';
        $('logro-submit').textContent = 'Crear logro';
        $('logro-cancel').classList.add('hidden');
    }

    function toggleLogro(e) {
        const l = state.logros.find(x => x.id === e.target.dataset.logroToggle);
        if (!l) return;
        l.activo = !l.activo;
        DamasPro.save(state);
        renderView();
    }

    function deleteLogro(e) {
        const id = e.target.dataset.logroDelete;
        if (!confirm('Eliminar este logro? Se quitara de la lista de logros disponibles, pero se conservara en el medallero de quienes ya lo ganaron.')) return;
        const logro = state.logros.find(l => l.id === id);
        (state.logros_cobradores || []).forEach(award => {
            if (award.logro_id === id && !award.logro_snapshot) award.logro_snapshot = DamasPro.logroSnapshot(logro);
        });
        state.logros = state.logros.filter(l => l.id !== id);
        DamasPro.save(state);
        renderView();
    }

    function currentWeekLogroAwards() {
        const week = DamasPro.activeWeek(state);
        return (state.logros_cobradores || [])
            .filter(x => x.fecha_inicio_semana === week.start)
            .map(x => ({
                award: x,
                cobrador: state.cobradores.find(c => c.id === x.cobrador_id),
                logro: DamasPro.resolveLogroAward(state, x)
            }))
            .filter(x => x.cobrador && x.logro)
            .sort((a, b) => String(b.award.fecha_desbloqueo || b.award.created_at || '').localeCompare(String(a.award.fecha_desbloqueo || a.award.created_at || '')));
    }

    function logroWinnersTable(rows) {
        if (!rows.length) return empty('Aun no hay logros desbloqueados esta semana.');
        return `<table class="w-full min-w-[680px] text-sm">
            <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2">Cobrador</th><th>Logro</th><th>Nivel</th><th>Forma</th><th>Fecha</th><th></th></tr></thead>
            <tbody>${rows.map(({ award, cobrador, logro }) => `<tr class="border-b last:border-0">
                <td class="py-3 font-bold">${h(DamasPro.displayName(cobrador))}</td>
                <td>${h(logro.nombre)}</td>
                <td>${h(logro.nivel)}</td>
                <td>${award.asignado_manualmente ? 'Manual' : 'Automatico'}</td>
                <td>${h(DamasPro.date(award.fecha_desbloqueo || award.created_at))}</td>
                <td class="text-right"><button data-logro-award="${award.id}" class="logro-revoke rounded-lg bg-red-50 text-red-500 px-3 py-1.5 text-xs font-bold">Quitar</button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    function awardLogro(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        if (!data.cobrador_id || !data.logro_id) return alert('Selecciona cobrador y logro.');
        const week = DamasPro.activeWeek(state);
        const exists = (state.logros_cobradores || []).some(x => x.cobrador_id === data.cobrador_id && x.logro_id === data.logro_id && x.fecha_inicio_semana === week.start);
        if (exists) return alert('Ese cobrador ya tiene este logro esta semana.');
        const now = new Date().toISOString();
        DamasPro.unblockLogro(state, data.cobrador_id, data.logro_id, week.start);
        const target = state.cobradores.find(c => c.id === data.cobrador_id);
        const logro = state.logros.find(l => l.id === data.logro_id);
        state.logros_cobradores.push({ id: DamasPro.uid('lc'), cobrador_id: data.cobrador_id, logro_id: data.logro_id, logro_snapshot: DamasPro.logroSnapshot(logro), fecha_inicio_semana: week.start, fecha_desbloqueo: now, asignado_manualmente: true, asignado_por: 'admin_mauricio', created_at: now });
        DamasPro.addMessage(state, {
            sender_type: 'admin',
            sender_id: 'admin_mauricio',
            sender_name: 'Admin Mauricio',
            recipient_type: 'cobrador',
            recipient_id: data.cobrador_id,
            recipient_name: DamasPro.displayName(target),
            title: 'Logro otorgado',
            body: `Felicitaciones, ${DamasPro.displayName(target)}. Se te otorgo el logro "${logro?.nombre || 'Logro'}".`,
            category: 'logro'
        });
        DamasPro.save(state);
        renderView();
    }

    function revokeLogro(e) {
        const id = e.target.dataset.logroAward;
        if (!confirm('Quitar este logro al cobrador?')) return;
        const award = (state.logros_cobradores || []).find(x => x.id === id);
        if (award && !award.asignado_manualmente) DamasPro.blockLogro(state, award);
        state.logros_cobradores = (state.logros_cobradores || []).filter(x => x.id !== id);
        DamasPro.save(state);
        renderView();
    }

    function renderPremios() {
        const week = DamasPro.activeWeek(state);
        const weekAwards = currentWeekPremioAwards();
        const candidates = premioCandidates();
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[380px_1fr] gap-5">
                <div class="space-y-5">
                    <form id="form-premio" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                        <h3 id="premio-form-title" class="font-heading font-bold text-brand-text">Crear premio</h3>
                        <input name="id" type="hidden">
                        ${fieldLabel('Nombre del premio', '<input name="nombre" class="field-input" placeholder="Ej. Recaudo PRO" required>')}
                        ${fieldLabel('Descripcion', '<textarea name="descripcion" class="field-input resize-none" rows="2" placeholder="Que debe lograr el cobrador" required></textarea>')}
                        ${fieldLabel('Texto motivacional', '<textarea name="texto_motivacional" class="field-input resize-none" rows="2" placeholder="Mensaje al desbloquear"></textarea>')}
                        ${fieldLabel('Tipo de meta asociada', '<select name="tipo_meta" class="field-input"><option value="creditos_nuevos">Creditos nuevos</option><option value="renovaciones">Renovaciones</option><option value="recaudo">Recaudo</option><option value="cumplimiento_general">Cumplimiento general</option><option value="manual">Manual</option></select>')}
                        ${fieldLabel('Valor objetivo de la meta', 'Numero que debe cumplir para desbloquearlo. Ej: 10 creditos o 10000000 de recaudo.', '<input name="valor_objetivo" class="field-input" type="number" min="0" placeholder="Ej. 10000000">')}
                        ${fieldLabel('Valor del premio para entregar (COP)', 'Monto economico del premio. Ej: 50000.', '<input name="valor_economico" class="field-input text-lg font-bold" type="number" min="0" placeholder="Ej. 50000" value="0">')}
                        ${fieldLabel('Nivel del premio', '<select name="nivel" class="field-input"><option>Bronce</option><option>Plata</option><option>Oro</option><option>Diamante</option></select>')}
                        ${fieldLabel('Imagen del premio', '<input name="imagen" class="field-input" type="file" accept="image/png,image/jpeg,image/webp">')}
                        <div class="grid grid-cols-2 gap-2">
                            <button id="premio-submit" class="bg-brand-blue text-white rounded-xl py-3 font-bold">Crear premio</button>
                            <button id="premio-cancel" type="button" class="hidden bg-brand-gray text-brand-text rounded-xl py-3 font-bold">Cancelar</button>
                        </div>
                        <div class="rounded-xl bg-brand-gray p-4 text-xs text-brand-text/60">
                            <b>Reinicio semanal:</b> al cambiar la semana del calendario, los premios se vuelven a evaluar para el nuevo periodo. Si necesitas limpiar los desbloqueos de esta semana para corregir pruebas, usa el boton de reinicio.
                        </div>
                        <button id="reset-awards" type="button" class="w-full border border-red-200 text-red-500 rounded-xl py-3 font-bold hover:bg-red-50">
                            Reiniciar premios y logros de esta semana
                        </button>
                        <p class="text-xs text-brand-text/40">Semana actual: ${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}. No borra premios creados ni historial de semanas anteriores.</p>
                    </form>
                    <form id="form-award-premio" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                        <h3 class="font-heading font-bold text-brand-text">Otorgar premio manual</h3>
                        ${fieldLabel('Cobrador', `<select name="cobrador_id" class="field-input">${options()}</select>`)}
                        ${fieldLabel('Premio', `<select name="premio_id" class="field-input">${(state.premios || []).map(p => `<option value="${p.id}">${h(p.nombre)} - ${DamasPro.money(p.valor_economico || 0)}</option>`).join('')}</select>`)}
                        <button class="w-full bg-brand-green text-white rounded-xl py-3 font-bold">Otorgar premio</button>
                    </form>
                </div>
                <div class="space-y-5">
                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                        <h3 class="font-heading font-bold text-brand-text mb-4">Ganadores de premios esta semana</h3>
                        ${premioWinnersTable(weekAwards)}
                    </section>
                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                        <h3 class="font-heading font-bold text-brand-text mb-4">Merecedores pendientes</h3>
                        ${premioCandidatesTable(candidates)}
                    </section>
                    <section class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${state.premios.map(p => premioCard(p)).join('')}</section>
                </div>
            </div>`;
        $('form-premio').addEventListener('submit', savePremio);
        $('premio-cancel').addEventListener('click', clearPremioForm);
        $('reset-awards').addEventListener('click', resetWeeklyAwards);
        $('form-award-premio').addEventListener('submit', awardPremio);
        document.querySelectorAll('.premio-toggle').forEach(btn => btn.addEventListener('click', togglePremio));
        document.querySelectorAll('.premio-edit').forEach(btn => btn.addEventListener('click', editPremio));
        document.querySelectorAll('.premio-delete').forEach(btn => btn.addEventListener('click', deletePremio));
        document.querySelectorAll('.premio-revoke').forEach(btn => btn.addEventListener('click', revokePremio));
        document.querySelectorAll('.premio-award-candidate').forEach(btn => btn.addEventListener('click', awardPremioCandidate));
    }

    function premioCard(p) {
        return `<article class="bg-white border border-brand-gray-dark rounded-xl p-4 shadow-sm">
            <div class="aspect-[4/3] rounded-xl bg-brand-gray flex items-center justify-center overflow-hidden mb-3">${p.imagen_url ? `<img src="${p.imagen_url}" class="w-full h-full object-cover" alt="${h(p.nombre)}">` : `<i class="fa-solid fa-trophy text-4xl text-brand-gold"></i>`}</div>
            <div class="flex justify-between gap-3"><h3 class="font-heading font-bold">${h(p.nombre)}</h3><span class="text-xs font-bold text-brand-blue">${h(p.nivel)}</span></div>
            <p class="text-sm text-brand-text/60 mt-1">${h(p.descripcion)}</p>
            <p class="text-sm font-bold text-brand-green mt-2">${DamasPro.money(p.valor_economico || 0)}</p>
            <p class="text-xs text-brand-text/40 mt-2">${h(p.tipo_meta)} >= ${h(p.valor_objetivo)}</p>
            <div class="mt-3 flex flex-wrap gap-2">
                <button data-edit="${p.id}" class="premio-edit rounded-lg bg-brand-blue text-white px-3 py-2 text-xs font-bold">Editar</button>
                <button data-premio="${p.id}" class="premio-toggle rounded-lg bg-brand-gray px-3 py-2 text-xs font-bold">${p.activo ? 'Desactivar' : 'Activar'}</button>
                <button data-delete="${p.id}" class="premio-delete rounded-lg bg-red-50 text-red-500 px-3 py-2 text-xs font-bold">Eliminar</button>
            </div>
        </article>`;
    }

    async function savePremio(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        let image = '';
        const file = fd.get('imagen');
        if (file && file.size) {
            try { image = await DamasPro.fileToDataUrl(file); } catch (err) { return alert(err.message); }
        }
        const id = fd.get('id');
        const payload = {
            nombre: fd.get('nombre').trim(),
            descripcion: fd.get('descripcion').trim(),
            texto_motivacional: fd.get('texto_motivacional').trim(),
            tipo_meta: fd.get('tipo_meta'),
            valor_objetivo: Number(fd.get('valor_objetivo') || 0),
            valor_economico: Number(fd.get('valor_economico') || 0),
            nivel: fd.get('nivel'),
            asignacion_manual: fd.get('tipo_meta') === 'manual',
            updated_at: new Date().toISOString()
        };
        if (id) {
            const premio = state.premios.find(p => p.id === id);
            Object.assign(premio, payload);
            if (image) premio.imagen_url = image;
        } else {
            const week = DamasPro.activeWeek(state);
            state.premios.push({ id: DamasPro.uid('premio'), ...payload, imagen_url: image, fecha_inicio: week.start, fecha_fin: week.end, activo: true, created_by: 'admin_mauricio', created_at: new Date().toISOString() });
        }
        DamasPro.recomputeUnlocks(state);
        DamasPro.save(state);
        renderView();
    }

    function editPremio(e) {
        const p = state.premios.find(x => x.id === e.target.dataset.edit);
        const form = $('form-premio');
        form.elements.id.value = p.id;
        form.nombre.value = p.nombre || '';
        form.descripcion.value = p.descripcion || '';
        form.texto_motivacional.value = p.texto_motivacional || '';
        form.tipo_meta.value = p.tipo_meta || 'creditos_nuevos';
        form.valor_objetivo.value = p.valor_objetivo || 0;
        form.valor_economico.value = p.valor_economico || 0;
        form.nivel.value = p.nivel || 'Bronce';
        $('premio-form-title').textContent = 'Editar premio';
        $('premio-submit').textContent = 'Guardar cambios';
        $('premio-cancel').classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearPremioForm() {
        const form = $('form-premio');
        form.reset();
        form.elements.id.value = '';
        form.valor_economico.value = 0;
        $('premio-form-title').textContent = 'Crear premio';
        $('premio-submit').textContent = 'Crear premio';
        $('premio-cancel').classList.add('hidden');
    }

    function resetWeeklyAwards() {
        if (!confirm('Esto reinicia premios y logros desbloqueados de la semana actual. El historial de semanas anteriores se conserva.')) return;
        DamasPro.resetWeeklyAwards(state);
        renderView();
    }

    function togglePremio(e) {
        const p = state.premios.find(x => x.id === e.target.dataset.premio);
        p.activo = !p.activo;
        DamasPro.save(state);
        renderView();
    }

    function currentWeekPremioAwards() {
        const week = DamasPro.activeWeek(state);
        return (state.premios_cobradores || [])
            .filter(x => x.fecha_inicio_periodo === week.start)
            .map(x => ({
                award: x,
                cobrador: state.cobradores.find(c => c.id === x.cobrador_id),
                premio: DamasPro.resolvePremioAward(state, x)
            }))
            .filter(x => x.cobrador && x.premio)
            .sort((a, b) => String(b.award.fecha_desbloqueo || b.award.created_at || '').localeCompare(String(a.award.fecha_desbloqueo || a.award.created_at || '')));
    }

    function premioWinnersTable(rows) {
        if (!rows.length) return empty('Aun no hay premios desbloqueados esta semana.');
        return `<table class="w-full min-w-[760px] text-sm">
            <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2">Cobrador</th><th>Premio</th><th>Valor</th><th>Forma</th><th>Fecha</th><th></th></tr></thead>
            <tbody>${rows.map(({ award, cobrador, premio }) => `<tr class="border-b last:border-0">
                <td class="py-3 font-bold">${h(DamasPro.displayName(cobrador))}</td>
                <td>${h(premio.nombre)}</td>
                <td>${DamasPro.money(premio.valor_economico || 0)}</td>
                <td>${award.asignado_manualmente ? 'Manual' : 'Automatico'}</td>
                <td>${h(DamasPro.date(award.fecha_desbloqueo || award.created_at))}</td>
                <td class="text-right"><button data-premio-award="${award.id}" class="premio-revoke rounded-lg bg-red-50 text-red-500 px-3 py-1.5 text-xs font-bold">Quitar</button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    function premioCandidates() {
        const week = DamasPro.activeWeek(state);
        const activePremios = (state.premios || []).filter(p => p.activo && p.tipo_meta !== 'manual');
        return state.cobradores
            .filter(c => c.estado === 'activo')
            .flatMap(c => {
                const resumen = DamasPro.resumenCobrador(state, c.id);
                return activePremios.map(p => {
                    const actual = DamasPro.metricValue(resumen, p.tipo_meta);
                    const percent = DamasPro.pct(actual, p.valor_objetivo);
                    const awarded = (state.premios_cobradores || []).some(x => x.cobrador_id === c.id && x.premio_id === p.id && x.fecha_inicio_periodo === week.start);
                    const blocked = (state.premios_bloqueados || []).some(x => x.cobrador_id === c.id && x.premio_id === p.id && x.fecha_inicio_periodo === week.start);
                    return { cobrador: c, premio: p, actual, percent, awarded, blocked };
                });
            })
            .filter(x => !x.awarded && !x.blocked && x.percent >= 100)
            .sort((a, b) => b.percent - a.percent);
    }

    function premioCandidatesTable(rows) {
        if (!rows.length) return empty('No hay cobradores pendientes para premio.');
        return `<table class="w-full min-w-[820px] text-sm">
            <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2">Cobrador</th><th>Premio</th><th>Meta</th><th>Cumplimiento</th><th>Valor</th><th></th></tr></thead>
            <tbody>${rows.map(({ cobrador, premio, actual, percent }) => `<tr class="border-b last:border-0">
                <td class="py-3 font-bold">${h(DamasPro.displayName(cobrador))}</td>
                <td>${h(premio.nombre)}</td>
                <td>${h(labelMeta(premio.tipo_meta))}: ${h(actual)} / ${h(premio.valor_objetivo || 0)}</td>
                <td><b class="text-brand-green">${Math.round(percent)}%</b></td>
                <td>${DamasPro.money(premio.valor_economico || 0)}</td>
                <td class="text-right"><button data-cobrador="${cobrador.id}" data-premio="${premio.id}" class="premio-award-candidate rounded-lg bg-brand-green text-white px-3 py-1.5 text-xs font-bold">Otorgar</button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    function labelMeta(type) {
        return { creditos_nuevos: 'Creditos nuevos', renovaciones: 'Renovaciones', recaudo: 'Recaudo', cumplimiento_general: 'Cumplimiento general', manual: 'Manual' }[type] || type;
    }

    function awardPremio(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        awardPremioTo(data.cobrador_id, data.premio_id);
    }

    function awardPremioCandidate(e) {
        awardPremioTo(e.target.dataset.cobrador, e.target.dataset.premio);
    }

    function awardPremioTo(cobradorId, premioId) {
        if (!cobradorId || !premioId) return alert('Selecciona cobrador y premio.');
        const week = DamasPro.activeWeek(state);
        const exists = (state.premios_cobradores || []).some(x => x.cobrador_id === cobradorId && x.premio_id === premioId && x.fecha_inicio_periodo === week.start);
        if (exists) return alert('Ese cobrador ya tiene este premio esta semana.');
        const now = new Date().toISOString();
        DamasPro.unblockPremio(state, cobradorId, premioId, week.start);
        const target = state.cobradores.find(c => c.id === cobradorId);
        const premio = state.premios.find(p => p.id === premioId);
        state.premios_cobradores.push({ id: DamasPro.uid('pc'), cobrador_id: cobradorId, premio_id: premioId, premio_snapshot: DamasPro.premioSnapshot(premio), fecha_inicio_periodo: week.start, fecha_fin_periodo: week.end, desbloqueado: true, fecha_desbloqueo: now, asignado_manualmente: true, asignado_por: 'admin_mauricio', created_at: now });
        DamasPro.addMessage(state, {
            sender_type: 'admin',
            sender_id: 'admin_mauricio',
            sender_name: 'Admin Mauricio',
            recipient_type: 'cobrador',
            recipient_id: cobradorId,
            recipient_name: DamasPro.displayName(target),
            title: 'Premio otorgado',
            body: `Felicitaciones, ${DamasPro.displayName(target)}. Se te otorgo el premio "${premio?.nombre || 'Premio'}" por valor de ${DamasPro.money(premio?.valor_economico || 0)}.`,
            category: 'premio'
        });
        DamasPro.save(state);
        renderView();
    }

    function revokePremio(e) {
        const id = e.target.dataset.premioAward;
        if (!confirm('Quitar este premio al cobrador?')) return;
        const award = (state.premios_cobradores || []).find(x => x.id === id);
        if (award && !award.asignado_manualmente) DamasPro.blockPremio(state, award);
        state.premios_cobradores = (state.premios_cobradores || []).filter(x => x.id !== id);
        DamasPro.save(state);
        renderView();
    }

    function renderFrase() {
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[420px_1fr] gap-5">
                <form id="form-frase" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Frase de la semana</h3>
                    <input name="titulo" class="field-input" placeholder="Titulo opcional">
                    <textarea name="texto" class="field-input resize-none" rows="5" placeholder="Texto de la frase" required></textarea>
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Activar nueva frase</button>
                    <p class="text-xs text-brand-text/40">Al activar una nueva frase, las anteriores quedan inactivas.</p>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-4">Historial</h3>
                    <div class="space-y-3">${state.frases.slice().reverse().map(fraseCard).join('') || empty('No hay frases guardadas.')}</div>
                </section>
            </div>`;
        $('form-frase').addEventListener('submit', saveFrase);
        document.querySelectorAll('.frase-activate').forEach(btn => btn.addEventListener('click', activateFrase));
        document.querySelectorAll('.frase-delete').forEach(btn => btn.addEventListener('click', deleteFrase));
    }

    function fraseCard(f) {
        return `<div class="rounded-xl border ${f.activa ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <b>${h(f.titulo || 'Frase')}</b>
                    <p class="text-brand-text/70 mt-1">${h(f.texto)}</p>
                    <p class="text-xs text-brand-text/40 mt-2">${f.activa ? 'Activa' : 'Inactiva'} - ${h(DamasPro.date(f.fecha_inicio))}</p>
                </div>
                <span class="shrink-0 text-xs rounded-full px-2 py-1 ${f.activa ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${f.activa ? 'En uso' : 'Guardada'}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
                <button data-frase="${f.id}" class="frase-activate rounded-lg ${f.activa ? 'bg-brand-gray text-brand-text/45' : 'bg-brand-blue text-white'} px-3 py-2 text-xs font-bold" ${f.activa ? 'disabled' : ''}>Usar esta frase</button>
                <button data-frase="${f.id}" class="frase-delete rounded-lg bg-red-50 text-red-500 px-3 py-2 text-xs font-bold">Eliminar</button>
            </div>
        </div>`;
    }

    function saveFrase(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        state.frases.forEach(f => f.activa = false);
        state.frases.push({ id: DamasPro.uid('frase'), titulo: data.titulo.trim(), texto: data.texto.trim(), activa: true, fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: '', created_by: 'admin_mauricio', created_at: new Date().toISOString() });
        DamasPro.save(state);
        renderView();
    }

    function activateFrase(e) {
        const frase = state.frases.find(f => f.id === e.target.dataset.frase);
        if (!frase) return;
        state.frases.forEach(f => f.activa = false);
        frase.activa = true;
        frase.fecha_inicio = new Date().toISOString().slice(0, 10);
        frase.fecha_fin = '';
        DamasPro.save(state);
        renderView();
    }

    function deleteFrase(e) {
        const id = e.target.dataset.frase;
        const frase = state.frases.find(f => f.id === id);
        if (!frase) return;
        if (!confirm('Eliminar esta frase del historial?')) return;
        state.frases = state.frases.filter(f => f.id !== id);
        if (frase.activa && state.frases.length) {
            state.frases[state.frases.length - 1].activa = true;
        }
        DamasPro.save(state);
        renderView();
    }

    function renderHistorico() {
        DamasPro.archivePastWeeks(state);
        const history = (state.historial_semanal || [])
            .slice()
            .sort((a, b) => String(b.fecha_inicio_semana || '').localeCompare(String(a.fecha_inicio_semana || '')));
        const selectedId = sessionStorage.getItem('admin_historico_semana') || history[0]?.id || '';
        const selected = history.find(h => h.id === selectedId) || history[0];
        $('admin-view').innerHTML = `
            <div class="grid lg:grid-cols-[320px_1fr] gap-5">
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-2">Historico semanal</h3>
                    <p class="text-xs text-brand-text/45 mb-4">Semanas archivadas automaticamente y cortes guardados antes de reiniciar avances.</p>
                    ${history.length ? fieldLabel('Semana', `<select id="historico-select" class="field-input">${history.map(item => `<option value="${h(item.id)}" ${selected?.id === item.id ? 'selected' : ''}>${h(DamasPro.date(item.fecha_inicio_semana))} a ${h(DamasPro.date(item.fecha_fin_semana))}</option>`).join('')}</select>`) : empty('Aun no hay semanas archivadas.')}
                    ${selected ? `
                        <div class="grid grid-cols-2 gap-2 mt-5">
                            ${historicStat('Creditos', selected.total_creditos || 0)}
                            ${historicStat('Renovaciones', selected.total_renovaciones || 0)}
                            ${historicStat('Recaudo', DamasPro.money(selected.total_recaudo || 0))}
                            ${historicStat('Avances', selected.total_avances || 0)}
                        </div>
                        <p class="text-xs text-brand-text/40 mt-4">Archivo: ${selected.tipo_archivo === 'manual' ? 'reinicio manual' : 'automatico'}.</p>
                    ` : ''}
                </section>
                <div class="space-y-5">
                    ${selected ? `
                        <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                <h3 class="font-heading font-bold text-brand-text">Resumen por cobrador</h3>
                                <p class="text-xs text-brand-text/45">${h(DamasPro.date(selected.fecha_inicio_semana))} a ${h(DamasPro.date(selected.fecha_fin_semana))}</p>
                            </div>
                            ${historicResumenTable(selected.resumen || [])}
                        </section>
                        <section class="grid lg:grid-cols-2 gap-5">
                            <div class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                                <h3 class="font-heading font-bold text-brand-text mb-4">Logros ganados</h3>
                                ${historicAwardsTable(selected.logros || [], 'logro')}
                            </div>
                            <div class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                                <h3 class="font-heading font-bold text-brand-text mb-4">Premios ganados</h3>
                                ${historicAwardsTable(selected.premios || [], 'premio')}
                            </div>
                        </section>
                    ` : `
                        <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                            ${empty('Cuando termine una semana o reinicies avances, aparecera aqui el resumen.')}
                        </section>
                    `}
                </div>
            </div>`;
        const select = $('historico-select');
        if (select) {
            select.addEventListener('change', (e) => {
                sessionStorage.setItem('admin_historico_semana', e.target.value);
                renderHistorico();
            });
        }
    }

    function historicStat(label, value) {
        return `<div class="rounded-xl bg-brand-gray p-3">
            <p class="text-[11px] uppercase tracking-widest text-brand-text/45 font-bold">${label}</p>
            <p class="font-heading font-bold text-brand-text mt-1">${h(value)}</p>
        </div>`;
    }

    function historicResumenTable(rows) {
        if (!rows.length) return empty('No hay datos de cobradores en esta semana.');
        return `<table class="w-full min-w-[820px] text-sm table-fixed">
            <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2 w-56">Cobrador</th><th class="w-24 text-right">Creditos</th><th class="w-28 text-right">Renovaciones</th><th class="w-32 text-right">Recaudo</th><th class="w-28 text-right">Cumplimiento</th><th class="w-28">Estado</th></tr></thead>
            <tbody>${rows.slice().sort((a, b) => Number(b.cumplimientoGeneral || 0) - Number(a.cumplimientoGeneral || 0)).map(r => `
                <tr class="border-b last:border-0">
                    <td class="py-3"><b class="block truncate" title="${h(r.nombre)}">${h(r.nombre)}</b><span class="text-xs text-brand-text/40">${h(r.username || '')}</span></td>
                    <td class="text-right tabular-nums">${h(r.total?.creditos || 0)}/${h(r.meta?.meta_creditos_nuevos || 0)}</td>
                    <td class="text-right tabular-nums">${h(r.total?.renovaciones || 0)}/${h(r.meta?.meta_renovaciones || 0)}</td>
                    <td class="text-right tabular-nums whitespace-nowrap">${DamasPro.money(r.total?.recaudo || 0)}</td>
                    <td class="text-right"><b class="text-brand-green tabular-nums">${Math.round(r.cumplimientoGeneral || 0)}%</b></td>
                    <td><span class="block truncate" title="${h(DamasPro.estadoCumplimiento(r.cumplimientoGeneral || 0))}">${h(DamasPro.estadoCumplimiento(r.cumplimientoGeneral || 0))}</span></td>
                </tr>`).join('')}</tbody>
        </table>`;
    }

    function historicAwardsTable(rows, key) {
        if (!rows.length) return empty(`No hubo ${key === 'premio' ? 'premios' : 'logros'} en esta semana.`);
        return `<table class="w-full min-w-[480px] text-sm">
            <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2">Cobrador</th><th>${key === 'premio' ? 'Premio' : 'Logro'}</th><th>Fecha</th></tr></thead>
            <tbody>${rows.map(row => {
                const item = row[key] || {};
                return `<tr class="border-b last:border-0">
                    <td class="py-3">${h(row.nombre_cobrador || '-')}</td>
                    <td><b>${h(item.nombre || '-')}</b><p class="text-xs text-brand-text/40">${h(item.nivel || '')}</p></td>
                    <td class="text-xs text-brand-text/50">${h(DamasPro.date(row.fecha_desbloqueo))}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>`;
    }

    function renderRanking() {
        const week = DamasPro.activeWeek(state);
        $('admin-view').innerHTML = `
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm overflow-x-auto">
                <h3 class="font-heading font-bold text-brand-text mb-4">Ranking completo</h3>
                <table class="w-full min-w-[980px] text-sm table-fixed">
                    <thead><tr class="text-left text-brand-text/40 border-b"><th class="py-2 w-10">#</th><th class="w-64">Cobrador</th><th class="w-24 text-right">Creditos</th><th class="w-28 text-right">Renovaciones</th><th class="w-32 text-right">Recaudo</th><th class="w-28 text-right">Cumplimiento</th><th class="w-16 text-right">Logros</th><th class="w-16 text-right">Premios</th><th class="w-32">Estado</th><th class="w-20">Perfil</th></tr></thead>
                    <tbody>${ranking().map((r, i) => {
                        const c = r.cobrador;
                        const logros = state.logros_cobradores.filter(x => x.cobrador_id === c.id && x.fecha_inicio_semana === week.start).length;
                        const premios = state.premios_cobradores.filter(x => x.cobrador_id === c.id && x.fecha_inicio_periodo === week.start).length;
                        const status = DamasPro.estadoCumplimiento(r.cumplimientoGeneral);
                        return `<tr class="border-b last:border-0"><td class="py-3 font-bold">${i + 1}</td><td><div class="flex items-center gap-3 min-w-0">${avatar(c, 'w-9 h-9 shrink-0')}<b class="block min-w-0 truncate" title="${h(DamasPro.displayName(c))}">${h(DamasPro.displayName(c))}</b></div></td><td class="text-right tabular-nums">${r.total.creditos}/${r.meta.meta_creditos_nuevos || 0}</td><td class="text-right tabular-nums">${r.total.renovaciones}/${r.meta.meta_renovaciones || 0}</td><td class="text-right tabular-nums whitespace-nowrap">${DamasPro.money(r.total.recaudo)}</td><td class="text-right"><b class="text-brand-green tabular-nums">${Math.round(r.cumplimientoGeneral)}%</b></td><td class="text-right tabular-nums">${logros}</td><td class="text-right tabular-nums">${premios}</td><td><span class="block truncate" title="${h(status)}">${h(status)}</span></td><td><button data-profile="${c.id}" class="profile-btn rounded-lg bg-brand-green text-white px-3 py-1.5 text-xs font-bold">Ver</button></td></tr>`;
                    }).join('')}</tbody>
                </table>
            </section>`;
        document.querySelectorAll('.profile-btn').forEach(btn => btn.addEventListener('click', openAdminProfile));
    }

    function openAdminProfile(e) {
        renderAdminProfile(e.target.dataset.profile);
    }

    function renderAdminProfile(cobradorId) {
        const target = state.cobradores.find(c => c.id === cobradorId);
        if (!target) return;
        const r = DamasPro.resumenCobrador(state, target.id);
        const unlockedLogroAwards = state.logros_cobradores.filter(x => x.cobrador_id === target.id);
        const unlockedLogros = DamasPro.uniqueAwardItems(unlockedLogroAwards, x => DamasPro.resolveLogroAward(state, x), 'logro_id');
        const unlockedPremioAwards = state.premios_cobradores.filter(x => x.cobrador_id === target.id);
        const unlockedPremios = DamasPro.uniqueAwardItems(unlockedPremioAwards, x => DamasPro.resolvePremioAward(state, x), 'premio_id');
        $('admin-view').innerHTML = `
            <button id="back-admin-profile" class="mb-5 inline-flex items-center gap-2 text-brand-blue font-bold text-sm">
                <i class="fa-solid fa-arrow-left"></i> Volver
            </button>
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mb-5">
                <div class="flex flex-col sm:flex-row sm:items-center gap-5">
                    ${avatar(target, 'w-24 h-24')}
                    <div class="min-w-0 flex-1">
                        <p class="text-xs uppercase tracking-widest text-brand-text/40 font-bold">Perfil de cobrador</p>
                        <h3 class="font-heading font-bold text-2xl text-brand-text mt-1">${h(DamasPro.displayName(target))}</h3>
                        <p class="text-sm text-brand-text/50 mt-1">${h(target.nombre)} - ${h(target.username)} - ${h(target.estado)}</p>
                        <p class="text-sm font-bold text-brand-green mt-3">${Math.round(r.cumplimientoGeneral)}% cumplimiento general</p>
                    </div>
                </div>
                <div class="grid sm:grid-cols-3 gap-3 mt-5">
                    ${adminProfileMetric('Creditos', r.total.creditos, r.meta.meta_creditos_nuevos)}
                    ${adminProfileMetric('Renovaciones', r.total.renovaciones, r.meta.meta_renovaciones)}
                    ${adminProfileMetric('Recaudo', DamasPro.money(r.total.recaudo), DamasPro.money(r.meta.meta_recaudo || 0))}
                </div>
            </section>
            ${target.id === 'cob_ruta1' ? adminProfileEditForm(target) : ''}
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                <h3 class="font-heading font-bold text-brand-text mb-4">Medallero</h3>
                <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${unlockedLogros.map(l => adminProfileMedalCard(l, 'Logro')).join('')}
                    ${unlockedPremios.map(p => adminProfileMedalCard(p, 'Premio')).join('')}
                    ${!unlockedLogros.length && !unlockedPremios.length ? empty('Este cobrador aun no tiene medallas.') : ''}
                </div>
            </section>
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mt-5">
                <h3 class="font-heading font-bold text-brand-text mb-4">Logros desbloqueados</h3>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${unlockedLogros.map(adminProfileLogroCard).join('') || empty('Este cobrador aun no tiene logros desbloqueados.')}</div>
            </section>
        `;
        $('back-admin-profile').addEventListener('click', renderView);
        if (target.id === 'cob_ruta1') $('admin-profile-form').addEventListener('submit', saveAdminProfile);
    }

    function adminProfileEditForm(target) {
        return `<form id="admin-profile-form" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mb-5 space-y-4">
            <h3 class="font-heading font-bold text-brand-text">Editar perfil Ruta 1</h3>
            ${fieldLabel('Nickname', `<input name="nickname" class="field-input" value="${h(target.nickname || '')}" placeholder="Ej. Admin">`)}
            ${fieldLabel('Foto de perfil', '<input name="profile_image" class="field-input" type="file" accept="image/png,image/jpeg,image/webp">')}
            <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Guardar perfil</button>
        </form>`;
    }

    async function saveAdminProfile(e) {
        e.preventDefault();
        const form = e.target;
        const submit = form.querySelector('button');
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Guardando...';
        }
        const fd = new FormData(form);
        const ruta1 = state.cobradores.find(c => c.id === 'cob_ruta1');
        try {
            if (!ruta1) return alert('No se encontro Ruta 1.');
            ruta1.nickname = String(fd.get('nickname') || '').trim();
            const file = fd.get('profile_image');
            if (file && file.size) {
                ruta1.profile_image_url = await DamasPro.fileToDataUrl(file);
            }
            await DamasPro.save(state);
            alert('Perfil guardado correctamente.');
            renderAdminProfile(ruta1.id);
        } catch (err) {
            alert(err.message || 'No se pudo guardar el perfil.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = 'Guardar perfil';
            }
        }
    }

    function adminProfileMetric(label, value, target) {
        return `<div class="rounded-xl bg-brand-gray p-4">
            <p class="text-xs uppercase tracking-widest text-brand-text/40 font-bold">${label}</p>
            <p class="font-heading font-bold text-lg mt-1">${value}</p>
            <p class="text-xs text-brand-text/45 mt-1">Meta: ${target || 0}</p>
        </div>`;
    }

    function adminProfileLogroCard(l) {
        return `<article class="rounded-xl border border-brand-green bg-brand-green/5 p-4">
            <div class="flex items-center gap-3">
                ${l.imagen_url ? `<img src="${l.imagen_url}" alt="${h(l.nombre)}" class="w-12 h-12 rounded-xl object-cover border border-brand-gray-dark">` : `<i class="fa-solid ${h(l.icono || 'fa-medal')} text-brand-green"></i>`}
                <div><h4 class="font-bold">${h(l.nombre)}</h4><p class="text-xs text-brand-text/50">Desbloqueado - ${h(l.nivel)}</p></div>
            </div>
            <p class="text-sm text-brand-text/60 mt-2">${h(l.descripcion)}</p>
        </article>`;
    }

    function adminProfileMedalCard(item, type) {
        const icon = type === 'Premio' ? 'fa-trophy' : 'fa-medal';
        return `<article class="rounded-xl border border-brand-green bg-brand-green/5 p-4 text-center">
            <div class="mx-auto w-20 h-20 rounded-full bg-white border border-brand-green/25 shadow-sm flex items-center justify-center overflow-hidden">
                ${item.imagen_url ? `<img src="${item.imagen_url}" alt="${h(item.nombre)}" class="w-full h-full object-cover">` : `<i class="fa-solid ${icon} text-3xl text-brand-gold"></i>`}
            </div>
            <p class="text-[11px] uppercase tracking-widest text-brand-green font-bold mt-3">${type}</p>
            <h4 class="font-heading font-bold text-sm mt-1">${h(item.nombre)}</h4>
            <p class="text-xs text-brand-text/45 mt-1">${h(item.nivel || '')}</p>
        </article>`;
    }

    function empty(text) {
        return `<p class="text-sm text-brand-text/40 text-center py-6">${text}</p>`;
    }

    function avanceMetric(label, value) {
        return `<div class="rounded-lg bg-brand-gray px-3 py-2">
            <p class="text-[11px] uppercase tracking-widest text-brand-text/45 font-bold">${label}</p>
            <p class="text-base font-bold text-brand-text mt-1">${h(value)}</p>
        </div>`;
    }

    function setupAvancePreview() {
        const form = $('form-avance');
        ['creditos_nuevos', 'renovaciones', 'recaudo_dia'].forEach(name => {
            form[name].addEventListener('input', updateAvancePreview);
        });
        form.recaudo_dia.addEventListener('input', formatRecaudoField);
        form.recaudo_dia.addEventListener('blur', formatRecaudoField);
        updateAvancePreview();
    }

    function updateAvancePreview() {
        const form = $('form-avance');
        if (!form) return;
        const creditos = form.creditos_nuevos.value;
        const renovaciones = form.renovaciones.value;
        const recaudo = form.recaudo_dia.value;
        $('avance-preview-creditos').textContent = creditos === '' ? 'Sin agregar' : `${creditos} creditos nuevos`;
        $('avance-preview-renovaciones').textContent = renovaciones === '' ? 'Sin agregar' : `${renovaciones} renovaciones`;
        $('avance-preview-recaudo').textContent = parseMoneyInput(recaudo) <= 0 ? 'Sin agregar' : DamasPro.money(parseMoneyInput(recaudo));
    }

    function formatRecaudoField(e) {
        const value = parseMoneyInput(e.target.value);
        e.target.value = value > 0 ? formatMoneyInput(value) : '';
        updateAvancePreview();
    }

    function parseMoneyInput(value) {
        return Number(String(value || '').replace(/\D/g, '') || 0);
    }

    function formatMoneyInput(value) {
        return parseMoneyInput(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }

    function fieldLabel(label, helpOrControl, maybeControl) {
        const help = maybeControl ? helpOrControl : '';
        const control = maybeControl || helpOrControl;
        return `<label class="block">
            <span class="block text-sm font-bold text-brand-text mb-1.5">${label}</span>
            ${help ? `<span class="block text-xs text-brand-text/45 mb-2">${help}</span>` : ''}
            ${control}
        </label>`;
    }

    function deletePremio(e) {
        const id = e.target.dataset.delete;
        if (!confirm('Eliminar este premio? Se quitara de la lista de premios disponibles, pero se conservara en el medallero de quienes ya lo ganaron.')) return;
        const premio = state.premios.find(p => p.id === id);
        (state.premios_cobradores || []).forEach(award => {
            if (award.premio_id === id && !award.premio_snapshot) award.premio_snapshot = DamasPro.premioSnapshot(premio);
        });
        state.premios = state.premios.filter(p => p.id !== id);
        DamasPro.save(state);
        renderView();
    }

    async function render(adminName = 'Administrador') {
        const app = $('admin-app');
        if (app) app.innerHTML = '<div class="bg-white border border-brand-gray-dark rounded-xl p-6 text-brand-text">Cargando panel...</div>';
        try {
            state = await DamasPro.load();
            renderShell(adminName);
            renderView();
            DamasPro.startAutoSync((nextState) => {
                state = nextState;
                renderShell(adminName);
                renderView();
            });
        } catch (err) {
            console.error('No se pudo iniciar el panel administrativo:', err);
            if (app) app.innerHTML = `<div class="bg-white border border-red-200 rounded-xl p-6 text-brand-text"><h3 class="font-bold text-red-600 mb-2">No se pudo cargar el panel</h3><p class="text-sm">${h(err?.message || 'Error inesperado')}</p><button onclick="location.reload()" class="mt-4 bg-brand-blue text-white rounded-lg px-4 py-2 font-bold">Reintentar</button></div>`;
        }
    }

    window.DamasAdmin = { render };

    if (sessionStorage.getItem('admin_auth') === '1') {
        render();
    }
})();
