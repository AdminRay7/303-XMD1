// commands/qr.js
// Generate a QR code image from text.
// Usage: .qr https://github.com/AdminRay7/303-XMD1

const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'qr',
    category: 'tools',
    aliases: ['qrcode'],
    description: 'Generate a QR code from text or URL',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ');

        if (!text) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}qr <text or url>`) }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('📸 Generating QR...') }, { quoted: msg });

        try {
            // Free QR API (no key needed)
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
            const buffer = Buffer.from(res.data, 'binary');

            await conn.sendMessage(from, { 
                image: buffer, 
                caption: fancy(`📸 *QR Code Generated*\n\n${text}`) 
            }, { quoted: msg });

            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}
        } catch (e) {
            console.error('[qr] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to generate QR.`), edit: wait.key });
        }
    }
};