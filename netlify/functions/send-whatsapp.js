const fetch    = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');

const PHONE = '573232083263@c.us'; // número que recibe la solicitud

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
    const API_TOKEN   = process.env.GREEN_API_TOKEN;

    if (!INSTANCE_ID || !API_TOKEN) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Credenciales de API no configuradas' })
        };
    }

    let data;
    try {
        data = JSON.parse(event.body);
    } catch (_) {
        return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) };
    }

    const { fields, fotoFrontal, fotoTrasera, fotoCliente } = data;
    const BASE = `https://api.green-api.com/waInstance${INSTANCE_ID}`;

    // Construir el mensaje de texto
    const monto   = Number(fields.monto).toLocaleString('es-CO');
    const message =
        '🏦 *SOLICITUD DE CRÉDITO — Finanzas Da Más*\n\n' +
        `👤 Nombre: ${fields.nombre}\n` +
        `📋 Tipo documento: ${fields.tipoDocumento}\n` +
        `🪪 Número documento: ${fields.cedula}\n` +
        `📱 Celular: ${fields.celular}\n` +
        `📧 Correo: ${fields.correo}\n` +
        `🏙️ Ciudad: ${fields.ciudad}\n` +
        `🏢 Dir. trabajo: ${fields.direccion}, Barrio: ${fields.barrioTrabajo}\n` +
        `🏠 Dir. vivienda: ${fields.direccionVivienda}, Barrio: ${fields.barrioVivienda}\n` +
        `💼 Ocupación: ${fields.ocupacion}\n` +
        `🛍️ Producto: ${fields.producto}\n` +
        `💵 Monto: $${monto} COP`;

    try {
        // 1. Enviar mensaje de texto
        await fetch(`${BASE}/sendMessage/${API_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: PHONE, message })
        });

        // 2. Enviar foto frontal
        if (fotoFrontal) {
            await sendImageBase64(BASE, API_TOKEN, PHONE, fotoFrontal, 'cedula_frontal.jpg', 'Cédula — Parte frontal');
        }

        // 3. Enviar foto trasera
        if (fotoTrasera) {
            await sendImageBase64(BASE, API_TOKEN, PHONE, fotoTrasera, 'cedula_trasera.jpg', 'Documento — Parte trasera');
        }

        // 4. Enviar foto cliente
        if (fotoCliente) {
            await sendImageBase64(BASE, API_TOKEN, PHONE, fotoCliente, 'foto_cliente.jpg', 'Foto cliente');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true })
        };
    } catch (err) {
        console.error('Error Green API:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message })
        };
    }
};

async function sendImageBase64(base, apiToken, chatId, base64Data, fileName, caption) {
    const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer    = Buffer.from(rawBase64, 'base64');

    const fd = new FormData();
    fd.append('chatId',   chatId);
    fd.append('file',     buffer, { filename: fileName, contentType: 'image/jpeg' });
    fd.append('fileName', fileName);
    fd.append('caption',  caption);

    const res = await fetch(`${base}/sendFileByUpload/${apiToken}`, {
        method:  'POST',
        body:    fd,
        headers: fd.getHeaders()
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`sendFileByUpload error: ${res.status} — ${text}`);
    }
}
