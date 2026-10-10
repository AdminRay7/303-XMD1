const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'sticker',
    category: 'tools',
    aliases: ['s', 'stiker'],
    description: 'Convert an image/video to a WhatsApp sticker',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const type = Object.keys(m.message || {})[0];
        const mediaMsg = quoted ? quoted : m.message;
        const innerType = quoted
            ? Object.keys(quoted).find(k => ['imageMessage','videoMessage','stickerMessage'].includes(k))
            : (['imageMessage','videoMessage','stickerMessage'].includes(type) ? type : null);
        if (!innerType) return conn.sendMessage(from, { text: fancy('❌ Send or reply to an image/video with .sticker') }, { quoted: m });
        try {
            const kind = innerType === 'imageMessage' ? 'image'
                       : innerType === 'videoMessage' ? 'video' : 'sticker';
            const stream = await downloadContentFromMessage(mediaMsg[innerType], kind);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            await conn.sendMessage(from, { sticker: buffer }, { quoted: m });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m }); }
    }
};
