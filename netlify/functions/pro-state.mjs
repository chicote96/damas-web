import { getStore } from '@netlify/blobs';

const STORE_NAME = 'damas-pro';
const STATE_KEY = 'state';

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });

const restoreImages = (value, images) => {
    if (Array.isArray(value)) return value.map(item => restoreImages(item, images));
    if (!value || typeof value !== 'object') return value;
    if (Object.keys(value).length === 1 && Number.isInteger(value.__damas_image_ref)) {
        const image = images[value.__damas_image_ref];
        if (typeof image !== 'string' || !image.startsWith('data:image/')) {
            throw new Error('Referencia de imagen invalida');
        }
        return image;
    }
    Object.keys(value).forEach(key => value[key] = restoreImages(value[key], images));
    return value;
};

export default async (request) => {
    try {
        const store = getStore(STORE_NAME);

        if (request.method === 'GET') {
            const state = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' });
            return json({ state: state || null });
        }

        if (request.method === 'POST') {
            const encodedBody = await request.json();
            const images = Array.isArray(encodedBody.image_payloads) ? encodedBody.image_payloads : [];
            delete encodedBody.image_payloads;
            const body = restoreImages(encodedBody, images);

            if (body.action === 'close_week') {
                const current = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' });
                if (!current?.version) return json({ error: 'Estado no encontrado' }, 404);

                const expected = body.expected_week;
                const next = body.next_week;
                const archive = body.archive;
                if (!expected?.start || !expected?.end || !next?.start || !next?.end ||
                    !archive?.id || archive.fecha_inicio_semana !== expected.start ||
                    archive.fecha_fin_semana !== expected.end || next.start <= expected.start) {
                    return json({ error: 'Cierre semanal invalido' }, 400);
                }

                // A retry or a second open tab must not close the new week too.
                if (current.semana_activa?.start !== expected.start) {
                    return json({ ok: true, already_closed: true, state: current });
                }

                current.historial_semanal = current.historial_semanal || [];
                const archiveIndex = current.historial_semanal.findIndex(item => item.id === archive.id);
                if (archiveIndex >= 0) current.historial_semanal[archiveIndex] = archive;
                else current.historial_semanal.push(archive);
                current.historial_semanal.sort((a, b) =>
                    String(b.fecha_inicio_semana || '').localeCompare(String(a.fecha_inicio_semana || ''))
                );

                const belongsToClosedWeek = avance => avance.fecha_inicio_semana
                    ? avance.fecha_inicio_semana === expected.start
                    : avance.fecha >= expected.start && avance.fecha <= expected.end;
                current.avances = (current.avances || []).filter(avance => !belongsToClosedWeek(avance));
                current.semana_activa = {
                    start: next.start,
                    end: next.end,
                    status: 'abierta',
                    opened_at: new Date().toISOString(),
                    previous_start: expected.start
                };
                const revision = Number(current._sync?.revision || 0) + 1;
                current._sync = {
                    ...(current._sync || {}),
                    updated_at: new Date().toISOString(),
                    client_id: body.client_id || 'server',
                    revision
                };
                await store.setJSON(STATE_KEY, current);
                return json({ ok: true, revision, state: current });
            }

            if (!body.state || !body.state.version) {
                return json({ error: 'Estado invalido' }, 400);
            }

            const current = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' });
            const currentRevision = Number(current?._sync?.revision || 0);
            const expectedRevision = Number(body.expected_revision || 0);

            // Reject a whole-state write made from an older tab/device. Without
            // this check it can resurrect advances removed by a weekly close.
            if (current && expectedRevision !== currentRevision) {
                return json({ error: 'Estado desactualizado', revision: currentRevision }, 409);
            }

            const nextRevision = currentRevision + 1;
            body.state._sync = { ...(body.state._sync || {}), revision: nextRevision };
            await store.setJSON(STATE_KEY, body.state);
            return json({ ok: true, revision: nextRevision });
        }

        return json({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
        return json({ error: err.message }, 500);
    }
};
