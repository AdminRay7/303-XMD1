const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'url',
    category: 'media',
    aliases: ['geturl'],
    description: 'Get the direct URL of a quoted media (data URL)',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const type = Object.keys(m.message || {})[0];
        const mediaMsg = quoted || m.message;
        const innerType = Object.keys(mediaMsg).find(k => [
            'imageMessage','videoMessage','audioMessage','stickerMessage','documentMessage'
        ].includes(k));
        if (!innerType) return conn.sendMessage(from, { text: fancy('❌ Reply to a media message with .url') }, { quoted: m });
        try {
            const kind = innerType.replace('Message', '').toLowerCase();
            const stream = await downloadContentFromMessage(mediaMsg[innerType], kind);
            const chunks = [];
            let size = 0;
            const MAX = 5 * 1024 * 1024;
            for await (const c of stream) {
                size += c.length;
                if (size > MAX) throw new Error('Media too large (>5MB)');
                chunks.push(c);
            }
            const buffer = Buffer.concat(chunks);
            const mime = mediaMsg[innerType].mimetype || 'application/octet-stream';
            const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
            const short = dataUrl.length > 900
                ? `📎 Media: ${kind} · ${(size/1024).toFixed(1)} KB · MIME: ${mime}\n\n_Data URL too long to send — send as file instead._`
                : dataUrl;
            await conn.sendMessage(from, { text: `╭─〔 📎 ᴍᴇᴅɪᴀ ᴜʀʟ 〕\n│\n│ ${short}\n│\n╰──────────────────────` }, { quoted: m });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m });
        }
    }
};
