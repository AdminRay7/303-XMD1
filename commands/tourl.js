const { fancy } = require('../lib/font');
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'tourl',
    category: 'media',
    aliases: ['upload'],
    description: 'Upload a quoted media and get a hosted URL',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const type = Object.keys(m.message || {})[0];
        const mediaMsg = quoted || m.message;
        const innerType = Object.keys(mediaMsg).find(k => [
            'imageMessage','videoMessage','audioMessage'
        ].includes(k));
        if (!innerType) return conn.sendMessage(from, { text: fancy('❌ Reply to an image/video/audio with .tourl') }, { quoted: m });
        try {
            const kind = innerType.replace('Message', '').toLowerCase();
            const stream = await downloadContentFromMessage(mediaMsg[innerType], kind);
            const chunks = [];
            let size = 0;
            const MAX = 16 * 1024 * 1024;
            for await (const c of stream) {
                size += c.length;
                if (size > MAX) throw new Error('File too large (>16MB)');
                chunks.push(c);
            }
            const buffer = Buffer.concat(chunks);
            const form = new FormData();
            form.append('file', buffer, { filename: `upload.${kind}` });
            const r = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
                headers: form.getHeaders(), timeout: 30000, maxContentLength: 20 * 1024 * 1024
            });
            const url = r.data?.data?.url || '';
            if (!url) throw new Error('Upload failed');
            const direct = url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            await conn.sendMessage(from, { text: `╭─〔 🔗 ᴜᴘʟᴏᴀᴅᴇᴅ 〕\n│\n│ 📎 ${direct}\n│\n│ ⏳ Expires in 1 hour\n│\n╰──────────────────────` }, { quoted: m });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m });
        }
    }
};
