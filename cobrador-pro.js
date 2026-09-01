(function () {
    let state;
    let cobrador;
    let currentTab = 'inicio';

    const $ = (id) => document.getElementById(id);
    const h = (v) => DamasPro.escapeHtml(v);

    function avatar(c, size = 'w-12 h-12') {
        if (c.profile_image_url) return `<img src="${c.profile_image_url}" alt="${h(c.nombre)}" class="${size} rounded-full object-cover border border-brand-gray-dark">`;
        return `<div class="${size} rounded-full bg-brand-blue/10 text-brand-blue font-bold flex items-center justify-center border border-brand-blue/20">${h(DamasPro.initials(c.nickname || c.nombre))}</div>`;
    }

    function progressBar(percent, height = 'h-3') {
        return `<div class="${height} bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-brand-green rounded-full" style="width:${DamasPro.visualPct(percent)}%"></div></div>`;
    }

    function resumen(id = cobrador.id) {
        return DamasPro.resumenCobrador(state, id);
    }

    function allRanking() {
        return state.cobradores
            .filter(c => c.estado === 'activo')
            .map(c => DamasPro.resumenCobrador(state, c.id))
            .sort((a, b) => b.cumplimientoGeneral - a.cumplimientoGeneral);
    }

    async function init() {
        state = await DamasPro.load();
        DamasPro.recomputeUnlocks(state);
        const cobId = sessionStorage.getItem('cobrador_auth');
        if (cobId) {
            cobrador = state.cobradores.find(c => c.id === cobId && c.estado === 'activo');
            if (cobrador) showApp();
        }
        $('login-form').addEventListener('submit', login);
        $('logout-btn').addEventListener('click', logout);
        $('biometric-login-btn').addEventListener('click', loginWithBiometric);
        $('biometric-register-btn').addEventListener('click', registerBiometric);
        $('biometric-close-btn').addEventListener('click', closeBiometricBanner);
        updateBiometricLoginButton();
        DamasPro.startAutoSync((nextState) => {
            state = nextState;
            if (!cobrador) return;
            cobrador = state.cobradores.find(c => c.id === cobrador.id && c.estado === 'activo');
            if (!cobrador) return logout();
            $('header-name').textContent = `${DamasPro.displayName(cobrador)} - ${cobrador.username}`;
            renderView();
        });
        document.querySelectorAll('.pro-tab').forEach(btn => btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            renderTabs();
            renderView();
        }));
    }

    async function login(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const username = String(fd.get('username') || '').trim().toLowerCase();
        const pin = String(fd.get('pin') || '');
        const found = state.cobradores.find(c => c.username.toLowerCase() === username && c.estado === 'activo');
        if (!found || !(await DamasPro.verifyPin(found.pin_hash, pin))) {
            $('login-error').classList.remove('hidden');
            return;
        }
        found.last_login_at = new Date().toISOString();
        DamasPro.save(state);
        cobrador = found;
        sessionStorage.setItem('cobrador_auth', found.id);
        showApp();
        if (window.PublicKeyCredential && !localStorage.getItem(biometricKey(found.id))) {
            setTimeout(() => $('biometric-banner').classList.remove('hidden'), 800);
        }
    }

    function logout() {
        sessionStorage.removeItem('cobrador_auth');
        location.reload();
    }

    function showApp() {
        $('login-screen').style.display = 'none';
        $('app').classList.remove('hidden');
        $('header-name').textContent = `${DamasPro.displayName(cobrador)} - ${cobrador.username}`;
        renderTabs();
        renderView();
    }

    async function registerBiometric() {
        closeBiometricBanner();
        if (!window.PublicKeyCredential || !cobrador) {
            alert('Tu dispositivo no soporta autenticacion biometrica.');
            return;
        }
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: 'Cobrador PRO' },
                    user: {
                        id: new TextEncoder().encode(cobrador.id),
                        name: cobrador.username,
                        displayName: DamasPro.displayName(cobrador)
                    },
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 },
                        { type: 'public-key', alg: -257 }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    },
                    timeout: 60000
                }
            });
            const idBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            localStorage.setItem(biometricKey(cobrador.id), idBase64);
            updateBiometricLoginButton();
            alert('Huella / Face ID activado correctamente.');
        } catch (err) {
            if (err.name !== 'NotAllowedError') alert('No se pudo activar la biometria: ' + err.message);
        }
    }

    async function loginWithBiometric() {
        if (!window.PublicKeyCredential) return;
        const cobId = biometricCobradorId();
        const idBase64 = cobId ? localStorage.getItem(biometricKey(cobId)) : null;
        if (!cobId || !idBase64) return;
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const idBytes = Uint8Array.from(atob(idBase64), c => c.charCodeAt(0));
            await navigator.credentials.get({
                publicKey: {
                    challenge,
                    allowCredentials: [{ type: 'public-key', id: idBytes }],
                    userVerification: 'required',
                    timeout: 60000
                }
            });
            const found = state.cobradores.find(c => c.id === cobId && c.estado === 'activo');
            if (!found) return alert('La cuenta del cobrador ya no esta activa.');
            found.last_login_at = new Date().toISOString();
            DamasPro.save(state);
            cobrador = found;
            sessionStorage.setItem('cobrador_auth', found.id);
            showApp();
        } catch (err) {
            if (err.name !== 'NotAllowedError') alert('Error de autenticacion: ' + err.message);
        }
    }

    function updateBiometricLoginButton() {
        if (window.PublicKeyCredential && biometricCobradorId()) {
            $('biometric-login-wrap').classList.remove('hidden');
        }
    }

    function closeBiometricBanner() {
        $('biometric-banner').classList.add('hidden');
    }

    function biometricKey(cobradorId) {
        return `cobrador_biometric_cred_id_${cobradorId}`;
    }

    function biometricCobradorId() {
        return state.cobradores.find(c => localStorage.getItem(biometricKey(c.id)))?.id || '';
    }

    function renderTabs() {
        const unreadMessages = cobrador ? cobradorMessages().filter(m => m.recipient_type === 'cobrador' && !m.read).length : 0;
        document.querySelectorAll('.pro-tab').forEach(btn => {
            const active = btn.dataset.tab === currentTab;
            const isBuzon = btn.dataset.tab === 'buzon';
            btn.classList.toggle('border-brand-blue', active);
            btn.classList.toggle('text-brand-blue', active);
            btn.classList.toggle('border-transparent', !active && !isBuzon);
            btn.classList.toggle('text-brand-text/40', !active && !isBuzon);
            btn.classList.toggle('bg-brand-blue/10', isBuzon);
            btn.classList.toggle('rounded-t-xl', isBuzon);
            btn.classList.toggle('shadow-sm', isBuzon && unreadMessages > 0);
        });
        const badge = $('buzon-badge');
        if (badge) {
            badge.textContent = unreadMessages > 9 ? '9+' : String(unreadMessages);
            badge.classList.toggle('hidden', unreadMessages === 0);
        }
    }

    function renderView() {
        cobrador = state.cobradores.find(c => c.id === cobrador.id);
        if (currentTab === 'inicio') renderInicio();
        else if (currentTab === 'buzon') renderBuzon();
        else if (currentTab === 'pizarra') renderPizarra();
        else renderPerfil();
    }

    function renderInicio() {
        const phrase = DamasPro.activePhrase(state);
        const ranking = allRanking();
        const week = DamasPro.activeWeek(state);
        const myNotes = notasCobrador();
        const unreadNotes = myNotes.filter(n => !n.leido).length;
        const unreadMessages = cobradorMessages().filter(m => m.recipient_type === 'cobrador' && !m.read).length;
        const currentPrizeIds = state.premios_cobradores.filter(p => p.cobrador_id === cobrador.id && p.desbloqueado && p.fecha_inicio_periodo === week.start).map(p => p.premio_id);
        $('pro-view').innerHTML = `
            <section class="rounded-2xl bg-brand-dark text-white p-6 sm:p-8 shadow-lg mb-6">
                <p class="text-brand-gold text-xs font-bold uppercase tracking-widest">${h(phrase?.titulo || 'Frase de la semana')}</p>
                <h2 class="font-banco font-bold text-3xl sm:text-5xl leading-tight mt-3">${h(phrase?.texto || 'Compite contigo mismo y supera tus numeros.')}</h2>
            </section>

            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mb-5">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h3 class="font-heading font-bold text-brand-text">Buzon</h3>
                        <p class="text-xs text-brand-text/45 mt-1">Mensajes, premios y notificaciones del administrador.</p>
                    </div>
                    <button data-open-buzon="1" class="shrink-0 rounded-lg bg-brand-blue text-white px-4 py-2 text-sm font-bold">${unreadMessages} nuevos</button>
                </div>
            </section>

            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mb-5">
                <div class="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 class="font-heading font-bold text-brand-text">Pizarron de notas</h3>
                        <p class="text-xs text-brand-text/45 mt-1">Mensajes enviados desde el panel administrador.</p>
                    </div>
                    <span class="shrink-0 text-xs rounded-full px-3 py-1 font-bold ${unreadNotes ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unreadNotes} sin leer</span>
                </div>
                <div class="grid md:grid-cols-2 gap-3">${myNotes.slice(0, 4).map(noteCard).join('') || empty('No tienes notas del administrador.')}</div>
            </section>

            <div class="grid xl:grid-cols-[1.4fr_.8fr] gap-5 mb-5">
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <div class="flex items-center justify-between gap-4 mb-5">
                        <h3 class="font-heading font-bold text-brand-text">Competencia sana de la semana</h3>
                        <span class="text-xs text-brand-text/40 font-bold">Publico</span>
                    </div>
                    <div class="space-y-4">${ranking.map(publicRow).join('') || empty('Aun no hay cobradores activos.')}</div>
                </section>

                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <h3 class="font-heading font-bold text-brand-text mb-5">Top 3 semanal</h3>
                    <div class="space-y-3">${ranking.slice(0, 3).map((r, i) => topRow(r, i)).join('') || empty('Sin ranking.')}</div>
                </section>
            </div>

            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                <h3 class="font-heading font-bold text-brand-text mb-5">Premios de la semana</h3>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${state.premios.filter(p => p.activo).map(p => premioCard(p, currentPrizeIds.includes(p.id))).join('') || empty('No hay premios activos.')}
                </div>
            </section>
        `;
        document.querySelectorAll('.read-note').forEach(btn => btn.addEventListener('click', markRead));
        document.querySelectorAll('[data-open-buzon]').forEach(btn => btn.addEventListener('click', () => {
            currentTab = 'buzon';
            renderTabs();
            renderBuzon();
        }));
        document.querySelectorAll('.view-cobrador-profile').forEach(btn => btn.addEventListener('click', openPublicProfile));
    }

    function publicRow(r) {
        const c = r.cobrador;
        const status = DamasPro.estadoCumplimiento(r.cumplimientoGeneral, true);
        return `<article class="rounded-xl border border-brand-gray-dark p-4">
            <div class="flex items-center gap-3">
                ${avatar(c, 'w-11 h-11')}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="min-w-0 flex-1">
                            <p class="font-bold text-brand-text truncate" title="${h(DamasPro.displayName(c))}">${h(DamasPro.displayName(c))}</p>
                            ${c.nickname ? `<p class="text-xs text-brand-text/40 truncate">${h(c.nombre)}</p>` : ''}
                        </div>
                        <p class="shrink-0 min-w-[3.5rem] text-right font-heading font-bold text-brand-green tabular-nums">${Math.round(r.cumplimientoGeneral)}%</p>
                    </div>
                    ${progressBar(r.cumplimientoGeneral)}
                    <p class="text-xs text-brand-text/50 mt-2">Estado: ${status}</p>
                    <button data-cobrador-profile="${c.id}" class="view-cobrador-profile mt-3 text-brand-blue text-sm font-bold">Ver perfil</button>
                </div>
            </div>
        </article>`;
    }

    function topRow(r, index) {
        const badges = ['bg-brand-gold text-white', 'bg-slate-200 text-brand-text', 'bg-amber-700 text-white'];
        const c = r.cobrador;
        return `<div class="rounded-xl border border-brand-gray-dark p-4 flex items-center gap-3">
            <span class="${badges[index]} w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold">${index + 1}</span>
            ${avatar(c, 'w-10 h-10')}
            <div class="flex-1 min-w-0"><p class="font-bold truncate" title="${h(DamasPro.displayName(c))}">${h(DamasPro.displayName(c))}</p><p class="text-xs text-brand-text/40 tabular-nums">${Math.round(r.cumplimientoGeneral)}% general</p><button data-cobrador-profile="${c.id}" class="view-cobrador-profile mt-2 text-brand-blue text-xs font-bold">Ver perfil</button></div>
        </div>`;
    }

    function openPublicProfile(e) {
        renderPublicProfile(e.target.dataset.cobradorProfile);
    }

    function renderPublicProfile(cobradorId) {
        const target = state.cobradores.find(c => c.id === cobradorId && c.estado === 'activo');
        if (!target) return;
        const r = DamasPro.resumenCobrador(state, target.id);
        const unlockedLogroAwards = state.logros_cobradores.filter(x => x.cobrador_id === target.id);
        const unlockedLogros = DamasPro.uniqueAwardItems(unlockedLogroAwards, x => DamasPro.resolveLogroAward(state, x), 'logro_id');
        $('pro-view').innerHTML = `
            <button id="back-to-inicio" class="mb-5 inline-flex items-center gap-2 text-brand-blue font-bold text-sm">
                <i class="fa-solid fa-arrow-left"></i> Volver
            </button>
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm mb-5">
                <div class="flex flex-col sm:flex-row sm:items-center gap-5">
                    ${avatar(target, 'w-24 h-24')}
                    <div class="min-w-0 flex-1">
                        <p class="text-xs uppercase tracking-widest text-brand-text/40 font-bold">Perfil publico</p>
                        <h3 class="font-heading font-bold text-2xl text-brand-text mt-1">${h(DamasPro.displayName(target))}</h3>
                        <p class="text-sm text-brand-text/50 mt-1">${h(target.nombre)} - ${h(target.username)}</p>
                        <p class="text-sm font-bold text-brand-green mt-3">${Math.round(r.cumplimientoGeneral)}% cumplimiento general</p>
                    </div>
                </div>
                <div class="grid sm:grid-cols-3 gap-3 mt-5">
                    ${publicMetric('Creditos', r.total.creditos, r.meta.meta_creditos_nuevos)}
                    ${publicMetric('Renovaciones', r.total.renovaciones, r.meta.meta_renovaciones)}
                    ${publicMetric('Recaudo', DamasPro.money(r.total.recaudo), DamasPro.money(r.meta.meta_recaudo || 0))}
                </div>
            </section>
            <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                <h3 class="font-heading font-bold text-brand-text mb-4">Logros desbloqueados</h3>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${unlockedLogros.map(publicLogroCard).join('') || empty('Este cobrador aun no tiene logros desbloqueados.')}</div>
            </section>
        `;
        $('back-to-inicio').addEventListener('click', renderInicio);
    }

    function publicMetric(label, value, target) {
        return `<div class="rounded-xl bg-brand-gray p-4">
            <p class="text-xs uppercase tracking-widest text-brand-text/40 font-bold">${label}</p>
            <p class="font-heading font-bold text-lg mt-1">${value}</p>
            <p class="text-xs text-brand-text/45 mt-1">Meta: ${target || 0}</p>
        </div>`;
    }

    function publicLogroCard(l) {
        return `<article class="rounded-xl border border-brand-green bg-brand-green/5 p-4">
            <div class="flex items-center gap-3">
                ${l.imagen_url ? `<img src="${l.imagen_url}" alt="${h(l.nombre)}" class="w-12 h-12 rounded-xl object-cover border border-brand-gray-dark">` : `<i class="fa-solid ${h(l.icono || 'fa-medal')} text-brand-green"></i>`}
                <div><h4 class="font-bold">${h(l.nombre)}</h4><p class="text-xs text-brand-text/50">Desbloqueado - ${h(l.nivel)}</p></div>
            </div>
            <p class="text-sm text-brand-text/60 mt-2">${h(l.descripcion)}</p>
        </article>`;
    }

    function renderBuzon() {
        const messages = cobradorMessages();
        const conversations = cobradorConversations(messages);
        const unread = messages.filter(m => m.recipient_type === 'cobrador' && !m.read).length;
        $('pro-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-message" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Enviar mensaje</h3>
                    ${fieldLabel('Para', `<select name="recipient" class="field-input">${messageRecipientOptions()}</select>`)}
                    ${fieldLabel('Titulo', '<input name="title" class="field-input" placeholder="Asunto del mensaje" required>')}
                    ${fieldLabel('Mensaje', '<textarea name="body" class="field-input resize-none" rows="5" placeholder="Escribe tu mensaje" required></textarea>')}
                    <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Enviar</button>
                </form>
                <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <h3 class="font-heading font-bold text-brand-text">Mi buzon</h3>
                        <span class="text-xs rounded-full px-3 py-1 font-bold ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread} sin leer</span>
                    </div>
                    <div class="space-y-4">${conversations.map(conversationCard).join('') || empty('No tienes mensajes.')}</div>
                </section>
            </div>`;
        $('form-message').addEventListener('submit', sendMessageToAdmin);
        document.querySelectorAll('.message-read').forEach(btn => btn.addEventListener('click', markMessageRead));
        document.querySelectorAll('.message-delete').forEach(btn => btn.addEventListener('click', deleteMessage));
        document.querySelectorAll('.reply-form').forEach(form => form.addEventListener('submit', sendReply));
    }

    function messageRecipientOptions() {
        const admins = '<option value="admin:admin_mauricio">Admin Mauricio</option>';
        const collectors = state.cobradores
            .filter(c => c.estado === 'activo' && c.id !== cobrador.id)
            .map(c => `<option value="cobrador:${c.id}">${h(DamasPro.displayName(c))}</option>`)
            .join('');
        return admins + collectors;
    }

    function cobradorMessages() {
        return (state.mensajes || [])
            .filter(m => (m.recipient_type === 'cobrador' && m.recipient_id === cobrador.id) || (m.sender_type === 'cobrador' && m.sender_id === cobrador.id))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    function cobradorConversations(messages) {
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

    function conversationCard(conversation) {
        const unread = conversation.messages.some(m => m.recipient_type === 'cobrador' && m.recipient_id === cobrador.id && !m.read);
        const latestIncoming = conversation.messages.slice().reverse().find(m => !(m.sender_type === 'cobrador' && m.sender_id === cobrador.id));
        let target = latestIncoming
            ? { id: latestIncoming.sender_id, type: latestIncoming.sender_type, name: latestIncoming.sender_name }
            : { id: conversation.latest.recipient_id, type: conversation.latest.recipient_type, name: conversation.latest.recipient_name };
        if (target.type === 'system') {
            target = { id: 'admin_mauricio', type: 'admin', name: 'Admin Mauricio' };
        }
        return `<article class="rounded-xl border ${unread ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 class="font-bold">${h(conversation.latest.title)}</h4>
                    <p class="text-xs text-brand-text/40 mt-1">Conversacion con ${h(target.name || 'Usuario')} - ${conversation.messages.length} mensajes</p>
                </div>
                <span class="shrink-0 text-xs rounded-full px-2 py-1 ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread ? 'Nuevo' : 'Leido'}</span>
            </div>
            <div class="space-y-2">${conversation.messages.map(conversationMessage).join('')}</div>
            <form class="reply-form mt-4 flex flex-col sm:flex-row gap-2" data-thread="${conversation.threadId}" data-recipient-type="${h(target.type)}" data-recipient-id="${h(target.id)}" data-recipient-name="${h(target.name || '')}">
                <input name="body" class="field-input" placeholder="Responder esta conversacion" required>
                <button class="shrink-0 bg-brand-blue text-white rounded-xl px-4 py-2 font-bold">Responder</button>
            </form>
            <div class="mt-3 flex flex-wrap gap-2">
                ${unread ? `<button data-message="${conversation.threadId}" class="message-read text-brand-blue text-sm font-bold">Marcar conversacion como leida</button>` : ''}
                <button data-message-delete="${conversation.threadId}" class="message-delete text-red-500 text-sm font-bold">Eliminar conversacion</button>
            </div>
        </article>`;
    }

    function conversationMessage(m) {
        const mine = m.sender_type === 'cobrador' && m.sender_id === cobrador.id;
        return `<div class="rounded-lg ${mine ? 'bg-brand-blue/10' : 'bg-white'} border border-brand-gray-dark p-3">
            <p class="text-xs font-bold ${mine ? 'text-brand-blue' : 'text-brand-text/55'}">${mine ? 'Yo' : h(m.sender_name || 'Usuario')} - ${new Date(m.created_at).toLocaleString('es-CO')}</p>
            <p class="text-sm text-brand-text/75 mt-1 whitespace-pre-wrap">${h(m.body)}</p>
        </div>`;
    }

    function messageCard(m) {
        const incoming = m.recipient_type === 'cobrador';
        const unread = incoming && !m.read;
        const meta = incoming ? `De ${h(m.sender_name || 'Admin')}` : `Para ${h(m.recipient_name || 'Destinatario')}`;
        return `<article class="rounded-xl border ${unread ? 'border-brand-blue bg-brand-blue/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h4 class="font-bold">${h(m.title)}</h4>
                        <span class="text-[11px] rounded-full bg-brand-gray px-2 py-1 text-brand-text/55">${h(m.category || 'mensaje')}</span>
                    </div>
                    <p class="text-xs text-brand-text/40 mt-1">${meta} - ${new Date(m.created_at).toLocaleDateString('es-CO')}</p>
                </div>
                <span class="shrink-0 text-xs rounded-full px-2 py-1 ${unread ? 'bg-brand-blue text-white' : 'bg-brand-gray text-brand-text/50'}">${unread ? 'Nuevo' : incoming ? 'Leido' : 'Enviado'}</span>
            </div>
            <p class="text-sm text-brand-text/70 mt-3 whitespace-pre-wrap">${h(m.body)}</p>
            <div class="mt-3 flex flex-wrap gap-2">
                ${unread ? `<button data-message="${m.id}" class="message-read text-brand-blue text-sm font-bold">Marcar como leido</button>` : ''}
                <button data-message-delete="${m.id}" class="message-delete text-red-500 text-sm font-bold">Eliminar</button>
            </div>
        </article>`;
    }

    function sendMessageToAdmin(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        const [recipientType, recipientId] = String(data.recipient || 'admin:admin_mauricio').split(':');
        const target = recipientType === 'admin'
            ? { id: 'admin_mauricio', name: 'Admin Mauricio' }
            : state.cobradores.find(c => c.id === recipientId && c.estado === 'activo');
        if (!target) return alert('Selecciona un destinatario valido.');
        DamasPro.addMessage(state, {
            sender_type: 'cobrador',
            sender_id: cobrador.id,
            sender_name: DamasPro.displayName(cobrador),
            recipient_type: recipientType,
            recipient_id: target.id,
            recipient_name: recipientType === 'admin' ? target.name : DamasPro.displayName(target),
            title: data.title.trim(),
            body: data.body.trim(),
            category: 'mensaje'
        });
        DamasPro.save(state);
        renderBuzon();
    }

    function markMessageRead(e) {
        const threadId = e.target.dataset.message;
        const now = new Date().toISOString();
        (state.mensajes || []).forEach(m => {
            if ((m.thread_id || m.id) === threadId && m.recipient_type === 'cobrador' && m.recipient_id === cobrador.id) {
                m.read = true;
                m.read_at = now;
            }
        });
        DamasPro.save(state);
        renderBuzon();
    }

    function deleteMessage(e) {
        if (!confirm('Eliminar esta conversacion del buzon?')) return;
        const threadId = e.target.dataset.messageDelete;
        state.mensajes = (state.mensajes || []).filter(m => (m.thread_id || m.id) !== threadId);
        DamasPro.save(state);
        renderBuzon();
    }

    function sendReply(e) {
        e.preventDefault();
        const form = e.target;
        const body = String(new FormData(form).get('body') || '').trim();
        if (!body) return;
        DamasPro.addMessage(state, {
            thread_id: form.dataset.thread,
            sender_type: 'cobrador',
            sender_id: cobrador.id,
            sender_name: DamasPro.displayName(cobrador),
            recipient_type: form.dataset.recipientType,
            recipient_id: form.dataset.recipientId,
            recipient_name: form.dataset.recipientName,
            title: 'Respuesta',
            body,
            category: 'mensaje'
        });
        DamasPro.save(state);
        renderBuzon();
    }

    function renderPizarra() {
        const week = DamasPro.activeWeek(state);
        const notes = pizarraNotasSemana();
        $('pro-view').innerHTML = `
            <div class="grid lg:grid-cols-[360px_1fr] gap-5">
                <form id="form-pizarra" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm space-y-4">
                    <h3 class="font-heading font-bold text-brand-text">Pizarra semanal</h3>
                    <p class="text-xs text-brand-text/45">Estas notas son visibles para todos los cobradores y el administrador.</p>
                    <input name="titulo" class="field-input" placeholder="Titulo corto" required>
                    <textarea name="mensaje" class="field-input resize-none" rows="5" placeholder="Escribe una nota para todos" required></textarea>
                    <button class="w-full bg-brand-green text-white rounded-xl py-3 font-bold">Publicar nota</button>
                    <p class="text-xs text-brand-text/40">Semana actual: ${DamasPro.date(week.start)} a ${DamasPro.date(week.end)}</p>
                </form>
                ${pizarraBoard(notes)}
            </div>`;
        $('form-pizarra').addEventListener('submit', savePizarraNota);
    }

    function pizarraBoard(notes) {
        return `<section class="rounded-xl p-5 shadow-sm border-4 border-[#7b4f2a]" style="background:#155f3b; box-shadow: inset 0 0 0 2px rgba(255,255,255,.08);">
            <div class="flex items-center justify-between gap-3 mb-5">
                <h3 class="font-heading font-bold text-white">Pizarra de la semana</h3>
                <span class="text-xs text-white/60 font-bold">${notes.length} notas</span>
            </div>
            <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${notes.map(pizarraNoteCard).join('') || `<p class="text-white/60 text-sm py-8 text-center md:col-span-2 xl:col-span-3">La pizarra esta vacia.</p>`}</div>
        </section>`;
    }

    function pizarraNoteCard(n) {
        const color = pizarraAuthorColor(n);
        return `<article class="rounded-lg text-brand-text p-4 shadow-md rotate-[-.5deg] border-l-4" style="background:${color.bg}; border-left-color:${color.border};">
            <h4 class="font-heading font-bold">${h(n.titulo)}</h4>
            <p class="text-xs text-brand-text/45 mt-1"><span class="inline-block w-2 h-2 rounded-full mr-1" style="background:${color.border};"></span>${h(n.autor_nombre || 'Cobrador')} - ${new Date(n.created_at).toLocaleDateString('es-CO')}</p>
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

    function savePizarraNota(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        state.pizarra_notas = state.pizarra_notas || [];
        state.pizarra_notas.push({ id: DamasPro.uid('pz'), titulo: data.titulo.trim(), mensaje: data.mensaje.trim(), autor_tipo: 'cobrador', autor_id: cobrador.id, autor_nombre: DamasPro.displayName(cobrador), fecha: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString() });
        DamasPro.save(state);
        renderPizarra();
    }

    function premioCard(p, unlocked) {
        const r = resumen();
        const value = DamasPro.metricValue(r, p.tipo_meta);
        const percent = p.tipo_meta === 'manual' ? (unlocked ? 100 : 0) : DamasPro.pct(value, p.valor_objetivo);
        const stateLabel = unlocked ? 'Desbloqueado' : percent > 0 ? 'En progreso' : 'Disponible';
        return `<article class="rounded-xl border border-brand-gray-dark p-4">
            <div class="aspect-[4/3] rounded-xl bg-brand-gray flex items-center justify-center overflow-hidden mb-3">${p.imagen_url ? `<img src="${p.imagen_url}" class="w-full h-full object-cover" alt="${h(p.nombre)}">` : `<i class="fa-solid fa-trophy text-4xl text-brand-gold"></i>`}</div>
            <div class="flex items-start justify-between gap-3">
                <h4 class="font-heading font-bold">${h(p.nombre)}</h4>
                <span class="text-xs rounded-full px-2 py-1 ${unlocked ? 'bg-brand-green text-white' : 'bg-brand-gray text-brand-text/60'}">${stateLabel}</span>
            </div>
            <p class="text-sm text-brand-text/60 mt-1">${h(p.descripcion)}</p>
            <div class="rounded-lg bg-brand-green/10 border border-brand-green/20 px-3 py-2 mt-3">
                <p class="text-[11px] uppercase tracking-widest text-brand-green font-bold">Valor del premio</p>
                <p class="text-lg font-heading font-bold text-brand-green mt-1">${premioValue(p)}</p>
            </div>
            <p class="text-xs text-brand-text/40 mt-2">Meta: ${h(labelMeta(p.tipo_meta))} ${p.valor_objetivo || ''}</p>
            <div class="mt-3">${progressBar(percent, 'h-2')}</div>
        </article>`;
    }

    function renderPerfil() {
        const r = resumen();
        const myNotes = notasCobrador();
        const week = DamasPro.activeWeek(state);
        const unlockedLogroIds = state.logros_cobradores.filter(x => x.cobrador_id === cobrador.id && x.fecha_inicio_semana === week.start).map(x => x.logro_id);
        const unlockedPremioIds = state.premios_cobradores.filter(x => x.cobrador_id === cobrador.id && x.fecha_inicio_periodo === week.start).map(x => x.premio_id);
        const medalLogroAwards = state.logros_cobradores.filter(x => x.cobrador_id === cobrador.id);
        const medalPremioAwards = state.premios_cobradores.filter(x => x.cobrador_id === cobrador.id);
        const unlockedLogros = DamasPro.uniqueAwardItems(medalLogroAwards, x => DamasPro.resolveLogroAward(state, x), 'logro_id');
        const unlockedPremios = DamasPro.uniqueAwardItems(medalPremioAwards, x => DamasPro.resolvePremioAward(state, x), 'premio_id');
        $('pro-view').innerHTML = `
            <div class="grid xl:grid-cols-[360px_1fr] gap-5">
                <section class="space-y-5">
                    <form id="profile-form" class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <div class="flex items-center gap-4">
                            ${avatar(cobrador, 'w-20 h-20')}
                            <div class="min-w-0">
                                <h3 class="font-heading font-bold text-lg truncate">${h(cobrador.nombre)}</h3>
                                <p class="text-sm text-brand-text/50">${h(cobrador.username)} - ${h(cobrador.estado)}</p>
                            </div>
                        </div>
                        <div class="mt-5 space-y-3">
                            <input name="nickname" class="field-input" value="${h(cobrador.nickname || '')}" placeholder="Sub nickname">
                            <input name="profile_image" class="field-input" type="file" accept="image/png,image/jpeg,image/webp">
                            <button class="w-full bg-brand-blue text-white rounded-xl py-3 font-bold">Guardar perfil</button>
                        </div>
                    </form>
                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <h3 class="font-heading font-bold mb-3">Metas personales</h3>
                        <p class="text-sm text-brand-text/60">Creditos nuevos: <b>${r.meta.meta_creditos_nuevos || 0}</b></p>
                        <p class="text-sm text-brand-text/60">Renovaciones: <b>${r.meta.meta_renovaciones || 0}</b></p>
                        <p class="text-sm text-brand-text/60">Recaudo: <b>${DamasPro.money(r.meta.meta_recaudo || 0)}</b></p>
                        <p class="text-xs text-brand-text/40 mt-3">${h(DamasPro.date(r.meta.fecha_inicio_semana))} a ${h(DamasPro.date(r.meta.fecha_fin_semana))}</p>
                    </section>
                </section>

                <section class="space-y-5">
                    <div class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <div class="flex items-center justify-between gap-4 mb-5">
                            <h3 class="font-heading font-bold">Progreso personal</h3>
                            <span class="font-heading font-bold text-brand-green">${Math.round(r.cumplimientoGeneral)}%</span>
                        </div>
                        ${metric('Creditos nuevos', r.total.creditos, r.meta.meta_creditos_nuevos, r.pCreditos)}
                        ${metric('Renovaciones', r.total.renovaciones, r.meta.meta_renovaciones, r.pRenovaciones)}
                        ${metric('Recaudo semanal', DamasPro.money(r.total.recaudo), DamasPro.money(r.meta.meta_recaudo || 0), r.pRecaudo)}
                        <p class="mt-4 rounded-xl bg-brand-green/10 text-brand-green p-4 text-sm font-bold">${motivacion(r.cumplimientoGeneral)}</p>
                    </div>

                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <h3 class="font-heading font-bold mb-4">Pizarron de Notas Privadas</h3>
                        <div class="space-y-3">${myNotes.map(noteCard).join('') || empty('No tienes notas privadas.')}</div>
                    </section>

                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <h3 class="font-heading font-bold mb-4">Medallero</h3>
                        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            ${unlockedLogros.map(l => medalCard(l, 'Logro')).join('')}
                            ${unlockedPremios.map(p => medalCard(p, 'Premio')).join('')}
                            ${!unlockedLogros.length && !unlockedPremios.length ? empty('Aun no tienes medallas.') : ''}
                        </div>
                    </section>

                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <h3 class="font-heading font-bold mb-4">Logros</h3>
                        <div class="grid sm:grid-cols-2 gap-3">${state.logros.filter(l => l.activo).map(l => logroCard(l, unlockedLogroIds.includes(l.id))).join('') || empty('No hay logros activos.')}</div>
                    </section>

                    <section class="bg-white border border-brand-gray-dark rounded-xl p-5 shadow-sm">
                        <h3 class="font-heading font-bold mb-4">Premios personales</h3>
                        <div class="grid sm:grid-cols-2 gap-4">${state.premios.filter(p => p.activo).map(p => premioCard(p, unlockedPremioIds.includes(p.id))).join('') || empty('No hay premios activos.')}</div>
                    </section>
                </section>
            </div>
        `;
        $('profile-form').addEventListener('submit', saveProfile);
        document.querySelectorAll('.read-note').forEach(btn => btn.addEventListener('click', markRead));
    }

    function metric(label, actual, meta, percent) {
        return `<div class="mb-4">
            <div class="flex items-center justify-between gap-3 mb-2">
                <p class="font-bold">${label}</p>
                <p class="text-sm text-brand-text/50">${actual} de ${meta || 0}</p>
            </div>
            ${progressBar(percent)}
            <p class="text-xs text-brand-text/40 mt-1">${Math.round(percent)}%</p>
        </div>`;
    }

    function noteCard(n) {
        return `<article class="rounded-xl border ${n.leido ? 'border-brand-gray-dark' : 'border-brand-blue bg-brand-blue/5'} p-4">
            <div class="flex items-start justify-between gap-3">
                <div><h4 class="font-bold">${h(n.titulo)}</h4><p class="text-xs text-brand-text/40 mt-1">${h(n.prioridad)} - ${new Date(n.created_at).toLocaleDateString('es-CO')}</p></div>
                <span class="text-xs rounded-full px-2 py-1 ${n.leido ? 'bg-brand-gray text-brand-text/50' : 'bg-brand-blue text-white'}">${n.leido ? 'Leida' : 'No leida'}</span>
            </div>
            <p class="text-sm text-brand-text/70 mt-3">${h(n.mensaje)}</p>
            ${n.leido ? '' : `<button data-note="${n.id}" class="read-note mt-3 text-brand-blue text-sm font-bold">Marcar como leida</button>`}
        </article>`;
    }

    function logroCard(l, unlocked) {
        const r = resumen();
        const percent = DamasPro.pct(DamasPro.metricValue(r, l.tipo), l.valor_objetivo);
        return `<article class="rounded-xl border ${unlocked ? 'border-brand-green bg-brand-green/5' : 'border-brand-gray-dark'} p-4">
            <div class="flex items-center gap-3">
                ${l.imagen_url ? `<img src="${l.imagen_url}" alt="${h(l.nombre)}" class="w-12 h-12 rounded-xl object-cover border border-brand-gray-dark">` : `<i class="fa-solid ${h(l.icono || 'fa-medal')} ${unlocked ? 'text-brand-green' : 'text-brand-text/30'}"></i>`}
                <div><h4 class="font-bold">${h(l.nombre)}</h4><p class="text-xs text-brand-text/50">${unlocked ? 'Desbloqueado' : 'Pendiente'} - ${h(l.nivel)}</p></div>
            </div>
            <p class="text-sm text-brand-text/60 mt-2">${h(l.descripcion)}</p>
            <div class="mt-3">${progressBar(percent, 'h-2')}</div>
        </article>`;
    }

    function medalCard(item, type) {
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

    async function saveProfile(e) {
        e.preventDefault();
        const submit = e.target.querySelector('button');
        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Guardando...';
        }
        const fd = new FormData(e.target);
        const nick = String(fd.get('nickname') || '').trim();
        const file = fd.get('profile_image');
        try {
            const idx = state.cobradores.findIndex(c => c.id === cobrador.id);
            if (idx < 0) return alert('No se encontro el cobrador.');
            const next = { ...state.cobradores[idx] };
            next.nickname = nick;
            if (file && file.size) {
                next.profile_image_url = await DamasPro.fileToDataUrl(file);
            }
            state.cobradores[idx] = next;
            cobrador = next;
            await DamasPro.save(state);
            $('header-name').textContent = `${DamasPro.displayName(cobrador)} - ${cobrador.username}`;
            alert('Perfil guardado correctamente.');
            renderPerfil();
        } catch (err) {
            alert(err.message || 'No se pudo guardar el perfil.');
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = 'Guardar perfil';
            }
        }
    }

    function markRead(e) {
        const note = state.notas.find(n => n.id === e.target.dataset.note && n.cobrador_id === cobrador.id);
        if (!note) return;
        note.leido = true;
        note.fecha_lectura = new Date().toISOString();
        DamasPro.save(state);
        renderView();
    }

    function notasCobrador() {
        return (state.notas || [])
            .filter(n => n.cobrador_id === cobrador.id)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }

    function premioValue(p) {
        const value = Number(p.valor_economico || 0);
        return value > 0 ? DamasPro.money(value) : 'Pendiente por definir';
    }

    function motivacion(p) {
        if (p >= 120) return 'Meta superada. Mantente constante y sigue marcando el ritmo.';
        if (p >= 100) return 'Meta cumplida. Excelente gestion semanal.';
        if (p >= 70) return 'Buen avance. Estas cerca de cerrar una gran semana.';
        return 'Cada gestion suma. Enfocate en el siguiente avance.';
    }

    function labelMeta(type) {
        return { creditos_nuevos: 'Creditos nuevos', renovaciones: 'Renovaciones', recaudo: 'Recaudo', cumplimiento_general: 'Cumplimiento general', manual: 'Manual' }[type] || type;
    }

    function fieldLabel(label, control) {
        return `<label class="block">
            <span class="block text-sm font-bold text-brand-text mb-1.5">${label}</span>
            ${control}
        </label>`;
    }

    function empty(text) {
        return `<p class="text-sm text-brand-text/40 text-center py-6">${text}</p>`;
    }

    init();
})();

