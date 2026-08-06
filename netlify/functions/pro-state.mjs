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

export default async (request) => {
    try {
        const store = getStore(STORE_NAME);

        if (request.method === 'GET') {
            const state = await store.get(STATE_KEY, { type: 'json', consistency: 'strong' });
            return json({ state: state || null });
        }

        if (request.method === 'POST') {
            const body = await request.json();
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
