const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'toimg',
    category: 'media',
    aliases: ['toimage'],
    description: 'Convert a sticker to an image',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const type = Object.keys(m.message || {})[0];
        const mediaMsg = quoted && quoted.stickerMessage ? quoted : m.message;
        if (!mediaMsg.stickerMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a sticker with .toimg') }, { quoted: m });
        }
        try {
            const stream = await downloadContentFromMessage(mediaMsg.stickerMessage, 'sticker');
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            await conn.sendMessage(from, { image: buffer, caption: fancy('✅ Sticker → Image') }, { quoted: m });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m });
        }
    }
};
