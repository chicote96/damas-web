(function () {
    const STORE_KEY = 'damas_cobrador_pro_state_v1';
    const SYNC_ENDPOINT = '/.netlify/functions/pro-state';
    const DATA_RESET_VERSION = 3;
    const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const CLIENT_KEY = 'damas_cobrador_pro_client_id';
    let lastSyncAt = '';
    let syncTimer = null;

    const todayIso = () => new Date().toISOString().slice(0, 10);

    function uid(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function clientId() {
        let id = localStorage.getItem(CLIENT_KEY);
        if (!id) {
            id = uid('client');
            localStorage.setItem(CLIENT_KEY, id);
        }
        return id;
    }

    async function sha256(value) {
        const bytes = new TextEncoder().encode(value);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hashPin(pin) {
        return sha256(`damas-pro:${pin}`);
    }

    function weekRange(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay() || 7;
        const start = new Date(d);
        start.setDate(d.getDate() - day + 1);
        const end = new Date(start);
        end.setDate(start.getDate() + 5);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }

    function nextWeekRange(range) {
        const start = new Date(`${range.start}T12:00:00`);
        start.setDate(start.getDate() + 7);
        return weekRange(start);
    }

    function ensureActiveWeekCurrent(state) {
        const today = weekRange();
        if (!state.semana_activa?.start || !state.semana_activa?.end) {
            state.semana_activa = { start: today.start, end: today.end, status: 'abierta', opened_at: new Date().toISOString() };
            return true;
        }
        if (state.semana_activa.end < today.start) {
            const previous = { start: state.semana_activa.start, end: state.semana_activa.end };
            upsertWeeklyArchive(state, buildWeeklyArchive(state, previous, 'auto'));
            state.semana_activa = { start: today.start, end: today.end, status: 'abierta', opened_at: new Date().toISOString(), previous_start: previous.start };
            return true;
        }
        return false;
    }

    function activeWeek(state) {
        ensureActiveWeekCurrent(state);
        return { start: state.semana_activa.start, end: state.semana_activa.end };
    }

    function defaultState() {
        const week = weekRange();
        return {
            version: 1,
            data_reset_version: DATA_RESET_VERSION,
            semana_activa: { start: week.start, end: week.end, status: 'abierta', opened_at: new Date().toISOString() },
            admins: [
                { id: 'admin_mauricio', username: 'mauricio', name: 'Mauricio', pin_hash: '', role: 'admin', status: 'activo' }
            ],
            cobradores: [
                { id: 'cob_ruta1', nombre: 'Ruta 1', username: 'ruta1', telefono: '', nickname: 'Admin', profile_image_url: '', estado: 'activo', pin_hash: '', role: 'cobrador', admin_id: 'admin_mauricio', last_login_at: null, created_at: todayIso() },
                { id: 'cob_ruta2', nombre: 'Ruta 2', username: 'ruta2', telefono: '', nickname: '', profile_image_url: '', estado: 'activo', pin_hash: '', role: 'cobrador', last_login_at: null, created_at: todayIso() },
                { id: 'cob_ruta4', nombre: 'Ruta 4', username: 'ruta4', telefono: '', nickname: '', profile_image_url: '', estado: 'activo', pin_hash: '', role: 'cobrador', last_login_at: null, created_at: todayIso() }
            ],
            metas: [],
            avances: [],
            notas: [],
            mensajes: [],
            pizarra_notas: [],
            historial_semanal: [],
            logros: [],
            logros_cobradores: [],
            logros_bloqueados: [],
            premios: [],
            premios_cobradores: [],
            premios_bloqueados: [],
            frases: [
                { id: 'frase_default', titulo: 'Frase de la semana', texto: 'Esta semana se gana con disciplina, constancia y resultados.', activa: true, fecha_inicio: week.start, fecha_fin: '', created_by: 'admin_mauricio', created_at: todayIso() }
            ]
        };
    }

    async function ensurePins(state) {
        let changed = false;
        for (const admin of state.admins || []) {
            if (!admin.pin_hash) {
                admin.pin_hash = await hashPin(admin.username === 'mauricio' ? '1296' : '0000');
                changed = true;
            }
        }
        for (const cob of state.cobradores || []) {
            if (!cob.pin_hash) {
                cob.pin_hash = await hashPin('0000');
                changed = true;
            }
        }
        if (changed) save(state);
        return state;
    }

    function normalizeState(state) {
        let changed = false;
        if (Number(state.data_reset_version || 0) < DATA_RESET_VERSION) {
            state.metas = [];
            state.avances = [];
            state.premios = [];
            state.premios_cobradores = [];
            state.premios_bloqueados = [];
            state.logros = [];
            state.logros_cobradores = [];
            state.logros_bloqueados = [];
            state.data_reset_version = DATA_RESET_VERSION;
            changed = true;
        }
        state.cobradores = state.cobradores || [];
        if (!state.cobradores.some(c => c.id === 'cob_ruta1' || c.username === 'ruta1')) {
            state.cobradores.unshift({ id: 'cob_ruta1', nombre: 'Ruta 1', username: 'ruta1', telefono: '', nickname: 'Admin', profile_image_url: '', estado: 'activo', pin_hash: '', role: 'cobrador', admin_id: 'admin_mauricio', last_login_at: null, created_at: todayIso() });
            changed = true;
        }
        state.metas = state.metas || [];
        state.avances = state.avances || [];
        state.avances.forEach(avance => {
            if (!avance.fecha) return;
            const range = weekRange(`${avance.fecha}T12:00:00`);
            if (avance.fecha_inicio_semana !== range.start || avance.fecha_fin_semana !== range.end) {
                avance.fecha_inicio_semana = range.start;
                avance.fecha_fin_semana = range.end;
                changed = true;
            }
        });
        state.notas = state.notas || [];
        state.mensajes = state.mensajes || [];
        state.pizarra_notas = state.pizarra_notas || [];
        state.historial_semanal = state.historial_semanal || [];
        if (ensureActiveWeekCurrent(state)) changed = true;
        state.premios = state.premios || [];
        state.premios.forEach(p => {
            if (p.valor_economico === undefined) {
                p.valor_economico = 0;
                changed = true;
            }
        });
        state.premios_cobradores = state.premios_cobradores || [];
        state.premios_cobradores.forEach(award => {
            if (!award.premio_snapshot) {
                const premio = state.premios.find(p => p.id === award.premio_id);
                if (premio) {
                    award.premio_snapshot = premioSnapshot(premio);
                    changed = true;
                }
            }
        });
        state.premios_bloqueados = state.premios_bloqueados || [];
        state.logros = state.logros || [];
        state.logros.forEach(l => {
            if (l.imagen_url === undefined) {
                l.imagen_url = '';
                changed = true;
            }
        });
        state.logros_cobradores = state.logros_cobradores || [];
        state.logros_cobradores.forEach(award => {
            if (!award.logro_snapshot) {
                const logro = state.logros.find(l => l.id === award.logro_id);
                if (logro) {
                    award.logro_snapshot = logroSnapshot(logro);
                    changed = true;
                }
            }
        });
        state.logros_bloqueados = state.logros_bloqueados || [];
        if (archivePastWeeks(state, false)) changed = true;
        if (changed) save(state);
        return state;
    }

    async function load() {
        let state = await loadRemote();
        if (!state) {
            try { state = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { state = null; }
        }
        if (!state || !state.version) {
            state = defaultState();
            save(state);
        }
        const normalized = await ensurePins(normalizeState(state));
        saveLocal(normalized);
        lastSyncAt = normalized._sync?.updated_at || '';
        return normalized;
    }

    function saveLocal(state) {
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }

    function save(state) {
        state._sync = { updated_at: new Date().toISOString(), client_id: clientId() };
        lastSyncAt = state._sync.updated_at;
        saveLocal(state);
        return saveRemote(state);
    }

    async function loadRemote() {
        try {
            const res = await fetch(SYNC_ENDPOINT, { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            return data && data.state && data.state.version ? data.state : null;
        } catch (_) {
            return null;
        }
    }

    async function saveRemote(state) {
        try {
            const res = await fetch(SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state })
            });
            if (!res.ok) {
                return false;
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    function startAutoSync(onUpdate, intervalMs = 5000) {
        if (syncTimer) clearInterval(syncTimer);
        syncTimer = setInterval(async () => {
            const remote = await loadRemote();
            if (!remote || !remote.version) return;
            const remoteSyncAt = remote._sync?.updated_at || '';
            if (!remoteSyncAt || remoteSyncAt <= lastSyncAt) return;
            lastSyncAt = remoteSyncAt;
            saveLocal(remote);
            onUpdate(normalizeState(remote));
        }, intervalMs);
        return () => {
            clearInterval(syncTimer);
            syncTimer = null;
        };
    }

    async function verifyPin(hash, pin) {
        return hash === await hashPin(pin);
    }

    function currentMeta(state, cobradorId, date = todayIso()) {
        const metas = (state.metas || []).filter(m => m.cobrador_id === cobradorId && m.activa);
        return metas.find(m => (!m.fecha_inicio_semana || m.fecha_inicio_semana <= date) && (!m.fecha_fin_semana || m.fecha_fin_semana >= date)) ||
            metas.slice().sort((a, b) => String(b.fecha_inicio_semana || '').localeCompare(String(a.fecha_inicio_semana || '')))[0] || null;
    }

    function weeklyAvances(state, cobradorId) {
        const week = activeWeek(state);
        return state.avances.filter(a => avanceInWeek(a, week) && a.cobrador_id === cobradorId);
    }

    function totals(state, cobradorId) {
        const week = activeWeek(state);
        return state.avances.filter(a => a.cobrador_id === cobradorId && avanceInWeek(a, week)).reduce((acc, a) => {
            acc.creditos += Number(a.creditos_nuevos || 0);
            acc.renovaciones += Number(a.renovaciones || 0);
            acc.recaudo += Number(a.recaudo_dia || 0);
            return acc;
        }, { creditos: 0, renovaciones: 0, recaudo: 0 });
    }

    function pct(actual, meta) {
        const m = Number(meta || 0);
        if (m <= 0) return 0;
        return (Number(actual || 0) / m) * 100;
    }

    function visualPct(value) {
        return Math.min(Math.max(Number(value || 0), 0), 100);
    }

    function resumenCobrador(state, cobradorId) {
        const cobrador = state.cobradores.find(c => c.id === cobradorId);
        const week = activeWeek(state);
        const meta = currentMeta(state, cobradorId, week.start) || {};
        const total = totals(state, cobradorId);
        const pCreditos = pct(total.creditos, meta.meta_creditos_nuevos);
        const pRenovaciones = pct(total.renovaciones, meta.meta_renovaciones);
        const pRecaudo = pct(total.recaudo, meta.meta_recaudo);
        const valid = [meta.meta_creditos_nuevos, meta.meta_renovaciones, meta.meta_recaudo].filter(v => Number(v || 0) > 0).length || 1;
        const cumplimientoGeneral = (pCreditos + pRenovaciones + pRecaudo) / valid;
        return { cobrador, meta, total, pCreditos, pRenovaciones, pRecaudo, cumplimientoGeneral };
    }

    function estadoCumplimiento(p, publico = false) {
        if (p >= 120) return 'Meta superada';
        if (p >= 100) return 'Meta cumplida';
        if (p >= 70) return 'Buen avance';
        if (p >= 40) return 'En progreso';
        return publico ? 'En progreso' : 'Bajo';
    }

    function metricValue(resumen, tipo) {
        if (tipo === 'creditos_nuevos') return resumen.total.creditos;
        if (tipo === 'renovaciones') return resumen.total.renovaciones;
        if (tipo === 'recaudo') return resumen.total.recaudo;
        if (tipo === 'cumplimiento_general') return resumen.cumplimientoGeneral;
        return 0;
    }

    function metaForDate(state, cobradorId, date) {
        const metas = (state.metas || []).filter(m => m.cobrador_id === cobradorId);
        return metas.find(m => (!m.fecha_inicio_semana || m.fecha_inicio_semana <= date) && (!m.fecha_fin_semana || m.fecha_fin_semana >= date)) ||
            metas.slice().sort((a, b) => String(b.fecha_inicio_semana || '').localeCompare(String(a.fecha_inicio_semana || '')))[0] || {};
    }

    function totalsForRange(state, cobradorId, range) {
        return (state.avances || [])
            .filter(a => a.cobrador_id === cobradorId && avanceInWeek(a, range))
            .reduce((acc, a) => {
                acc.creditos += Number(a.creditos_nuevos || 0);
                acc.renovaciones += Number(a.renovaciones || 0);
                acc.recaudo += Number(a.recaudo_dia || 0);
                acc.avances += 1;
                return acc;
            }, { creditos: 0, renovaciones: 0, recaudo: 0, avances: 0 });
    }

    function avanceInWeek(avance, range) {
        if (avance.fecha_inicio_semana) return avance.fecha_inicio_semana === range.start;
        return avance.fecha >= range.start && avance.fecha <= range.end;
    }

    function weeklyArchiveId(range) {
        return `hist_${range.start}`;
    }

    function buildWeeklyArchive(state, range, archiveType = 'auto') {
        const resumen = (state.cobradores || []).map(c => {
            const meta = metaForDate(state, c.id, range.start);
            const total = totalsForRange(state, c.id, range);
            const pCreditos = pct(total.creditos, meta.meta_creditos_nuevos);
            const pRenovaciones = pct(total.renovaciones, meta.meta_renovaciones);
            const pRecaudo = pct(total.recaudo, meta.meta_recaudo);
            const valid = [meta.meta_creditos_nuevos, meta.meta_renovaciones, meta.meta_recaudo].filter(v => Number(v || 0) > 0).length || 1;
            const cumplimientoGeneral = (pCreditos + pRenovaciones + pRecaudo) / valid;
            return {
                cobrador_id: c.id,
                nombre: displayName(c),
                username: c.username || '',
                estado: c.estado || '',
                meta: {
                    meta_creditos_nuevos: Number(meta.meta_creditos_nuevos || 0),
                    meta_renovaciones: Number(meta.meta_renovaciones || 0),
                    meta_recaudo: Number(meta.meta_recaudo || 0)
                },
                total,
                pCreditos,
                pRenovaciones,
                pRecaudo,
                cumplimientoGeneral
            };
        });
        const premios = (state.premios_cobradores || [])
            .filter(p => p.fecha_inicio_periodo === range.start)
            .map(p => ({
                id: p.id,
                cobrador_id: p.cobrador_id,
                nombre_cobrador: displayName((state.cobradores || []).find(c => c.id === p.cobrador_id)),
                premio: resolvePremioAward(state, p),
                fecha_desbloqueo: p.fecha_desbloqueo || p.created_at || ''
            }));
        const logros = (state.logros_cobradores || [])
            .filter(l => l.fecha_inicio_semana === range.start)
            .map(l => ({
                id: l.id,
                cobrador_id: l.cobrador_id,
                nombre_cobrador: displayName((state.cobradores || []).find(c => c.id === l.cobrador_id)),
                logro: resolveLogroAward(state, l),
                fecha_desbloqueo: l.fecha_desbloqueo || l.created_at || ''
            }));
        return {
            id: weeklyArchiveId(range),
            fecha_inicio_semana: range.start,
            fecha_fin_semana: range.end,
            tipo_archivo: archiveType,
            archived_at: new Date().toISOString(),
            total_avances: resumen.reduce((sum, r) => sum + Number(r.total.avances || 0), 0),
            total_creditos: resumen.reduce((sum, r) => sum + Number(r.total.creditos || 0), 0),
            total_renovaciones: resumen.reduce((sum, r) => sum + Number(r.total.renovaciones || 0), 0),
            total_recaudo: resumen.reduce((sum, r) => sum + Number(r.total.recaudo || 0), 0),
            resumen,
            premios,
            logros
        };
    }

    function upsertWeeklyArchive(state, archive) {
        state.historial_semanal = state.historial_semanal || [];
        const idx = state.historial_semanal.findIndex(h => h.id === archive.id);
        if (idx >= 0 && state.historial_semanal[idx].tipo_archivo === 'manual' && archive.tipo_archivo === 'auto') {
            return false;
        }
        if (idx >= 0 && archive.tipo_archivo === 'auto') {
            archive.archived_at = state.historial_semanal[idx].archived_at || archive.archived_at;
        }
        const previous = idx >= 0 ? JSON.stringify(state.historial_semanal[idx]) : '';
        const next = idx >= 0 ? { ...state.historial_semanal[idx], ...archive } : archive;
        if (idx >= 0) state.historial_semanal[idx] = next;
        else state.historial_semanal.push(next);
        state.historial_semanal.sort((a, b) => String(b.fecha_inicio_semana || '').localeCompare(String(a.fecha_inicio_semana || '')));
        return previous !== JSON.stringify(next);
    }

    function archivePastWeeks(state, shouldSave = true) {
        const current = activeWeek(state);
        const starts = new Set();
        (state.avances || []).forEach(a => {
            if (a.fecha_inicio_semana) starts.add(a.fecha_inicio_semana);
            else if (a.fecha) starts.add(weekRange(`${a.fecha}T12:00:00`).start);
        });
        (state.premios_cobradores || []).forEach(p => {
            if (p.fecha_inicio_periodo) starts.add(p.fecha_inicio_periodo);
        });
        (state.logros_cobradores || []).forEach(l => {
            if (l.fecha_inicio_semana) starts.add(l.fecha_inicio_semana);
        });
        let changed = false;
        starts.forEach(start => {
            const range = weekRange(`${start}T12:00:00`);
            if (range.end >= current.start) return;
            if (upsertWeeklyArchive(state, buildWeeklyArchive(state, range, 'auto'))) changed = true;
        });
        if (changed && shouldSave) save(state);
        return changed;
    }

    function addMessage(state, payload) {
        state.mensajes = state.mensajes || [];
        const now = new Date().toISOString();
        const message = {
            id: uid('msg'),
            thread_id: payload.thread_id || uid('thread'),
            reply_to: payload.reply_to || '',
            sender_type: payload.sender_type || 'system',
            sender_id: payload.sender_id || 'system',
            sender_name: payload.sender_name || 'Sistema',
            recipient_type: payload.recipient_type,
            recipient_id: payload.recipient_id,
            recipient_name: payload.recipient_name || '',
            title: payload.title || 'Mensaje',
            body: payload.body || '',
            category: payload.category || 'mensaje',
            read: false,
            read_at: null,
            created_at: now
        };
        state.mensajes.push(message);
        return message;
    }

    function logroSnapshot(logro) {
        return {
            nombre: logro?.nombre || 'Logro',
            descripcion: logro?.descripcion || '',
            tipo: logro?.tipo || '',
            valor_objetivo: Number(logro?.valor_objetivo || 0),
            nivel: logro?.nivel || '',
            icono: logro?.icono || 'fa-medal',
            imagen_url: logro?.imagen_url || ''
        };
    }

    function premioSnapshot(premio) {
        return {
            nombre: premio?.nombre || 'Premio',
            descripcion: premio?.descripcion || '',
            texto_motivacional: premio?.texto_motivacional || '',
            tipo_meta: premio?.tipo_meta || '',
            valor_objetivo: Number(premio?.valor_objetivo || 0),
            valor_economico: Number(premio?.valor_economico || 0),
            nivel: premio?.nivel || '',
            imagen_url: premio?.imagen_url || ''
        };
    }

    function resolveLogroAward(state, award) {
        return state.logros.find(l => l.id === award.logro_id) || award.logro_snapshot || logroSnapshot(null);
    }

    function resolvePremioAward(state, award) {
        return state.premios.find(p => p.id === award.premio_id) || award.premio_snapshot || premioSnapshot(null);
    }

    function uniqueAwardItems(awards, resolver, idKey) {
        const seen = new Set();
        return (awards || []).filter(award => {
            const key = award[idKey] || award.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map(resolver);
    }

    function unlockForCobrador(state, cobradorId) {
        let changed = false;
        const week = activeWeek(state);
        const resumen = resumenCobrador(state, cobradorId);
        const cobrador = state.cobradores.find(c => c.id === cobradorId);
        const now = new Date().toISOString();
        for (const logro of state.logros.filter(l => l.activo)) {
            const exists = state.logros_cobradores.some(x => x.cobrador_id === cobradorId && x.logro_id === logro.id && x.fecha_inicio_semana === week.start);
            const blocked = (state.logros_bloqueados || []).some(x => x.cobrador_id === cobradorId && x.logro_id === logro.id && x.fecha_inicio_semana === week.start);
            if (!exists && !blocked && metricValue(resumen, logro.tipo) >= Number(logro.valor_objetivo || 0)) {
                state.logros_cobradores.push({ id: uid('lc'), cobrador_id: cobradorId, logro_id: logro.id, logro_snapshot: logroSnapshot(logro), fecha_inicio_semana: week.start, fecha_desbloqueo: now, created_at: now });
                addMessage(state, {
                    recipient_type: 'cobrador',
                    recipient_id: cobradorId,
                    recipient_name: displayName(cobrador),
                    title: 'Logro desbloqueado',
                    body: `Felicitaciones, ${displayName(cobrador)}. Desbloqueaste el logro "${logro.nombre}". Sigue asi.`,
                    category: 'logro'
                });
                changed = true;
            }
        }
        return changed;
    }

    function recomputeUnlocks(state) {
        let changed = false;
        state.cobradores.forEach(c => {
            if (unlockForCobrador(state, c.id)) changed = true;
        });
        if (changed) save(state);
        return changed;
    }

    function resetWeeklyAwards(state) {
        const week = activeWeek(state);
        state.premios_cobradores = state.premios_cobradores.filter(p => p.fecha_inicio_periodo !== week.start);
        state.logros_cobradores = state.logros_cobradores.filter(l => l.fecha_inicio_semana !== week.start);
        state.premios_bloqueados = (state.premios_bloqueados || []).filter(p => p.fecha_inicio_periodo !== week.start);
        state.logros_bloqueados = (state.logros_bloqueados || []).filter(l => l.fecha_inicio_semana !== week.start);
        save(state);
    }

    function resetWeeklyProgress(state) {
        const week = activeWeek(state);
        const archive = buildWeeklyArchive(state, week, 'manual');
        upsertWeeklyArchive(state, archive);
        const before = (state.avances || []).length;
        state.avances = (state.avances || []).filter(a => !avanceInWeek(a, week));
        const calendarWeek = weekRange();
        const next = week.end < calendarWeek.start ? calendarWeek : nextWeekRange(week);
        state.semana_activa = { start: next.start, end: next.end, status: 'abierta', opened_at: new Date().toISOString(), previous_start: week.start };
        save(state);
        return { removed: before - state.avances.length, archive };
    }

    function blockLogro(state, award) {
        state.logros_bloqueados = state.logros_bloqueados || [];
        const exists = state.logros_bloqueados.some(x => x.cobrador_id === award.cobrador_id && x.logro_id === award.logro_id && x.fecha_inicio_semana === award.fecha_inicio_semana);
        if (!exists) {
            state.logros_bloqueados.push({ id: uid('lb'), cobrador_id: award.cobrador_id, logro_id: award.logro_id, fecha_inicio_semana: award.fecha_inicio_semana, blocked_at: new Date().toISOString() });
        }
    }

    function unblockLogro(state, cobradorId, logroId, fechaInicioSemana) {
        state.logros_bloqueados = (state.logros_bloqueados || []).filter(x => !(x.cobrador_id === cobradorId && x.logro_id === logroId && x.fecha_inicio_semana === fechaInicioSemana));
    }

    function blockPremio(state, award) {
        state.premios_bloqueados = state.premios_bloqueados || [];
        const exists = state.premios_bloqueados.some(x => x.cobrador_id === award.cobrador_id && x.premio_id === award.premio_id && x.fecha_inicio_periodo === award.fecha_inicio_periodo);
        if (!exists) {
            state.premios_bloqueados.push({ id: uid('pb'), cobrador_id: award.cobrador_id, premio_id: award.premio_id, fecha_inicio_periodo: award.fecha_inicio_periodo, blocked_at: new Date().toISOString() });
        }
    }

    function unblockPremio(state, cobradorId, premioId, fechaInicioPeriodo) {
        state.premios_bloqueados = (state.premios_bloqueados || []).filter(x => !(x.cobrador_id === cobradorId && x.premio_id === premioId && x.fecha_inicio_periodo === fechaInicioPeriodo));
    }

    function activePhrase(state) {
        return state.frases.find(f => f.activa) || null;
    }

    function displayName(c) {
        c = c || {};
        return (c.nickname || c.nombre || c.username || '').trim();
    }

    function initials(name) {
        return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
    }

    function money(value) {
        return Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function validateImage(file) {
        if (!file) return 'Selecciona una imagen.';
        if (!IMAGE_TYPES.includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o WEBP.';
        if (file.size > MAX_IMAGE_SIZE) return 'La imagen supera el tamano maximo de 1.5 MB.';
        return '';
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const err = validateImage(file);
            if (err) reject(new Error(err));
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.readAsDataURL(file);
        });
    }

    window.DamasPro = {
        load, save, uid, hashPin, verifyPin, weekRange, activeWeek, currentMeta, weeklyAvances, totals,
        pct, visualPct, resumenCobrador, estadoCumplimiento, metricValue, unlockForCobrador,
        recomputeUnlocks, resetWeeklyAwards, resetWeeklyProgress, archivePastWeeks, activePhrase, displayName, initials, money, escapeHtml, validateImage, fileToDataUrl
        , blockLogro, blockPremio, unblockLogro, unblockPremio
        , logroSnapshot, premioSnapshot, resolveLogroAward, resolvePremioAward, uniqueAwardItems
        , addMessage
        , startAutoSync
    };
})();
