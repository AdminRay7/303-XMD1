const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'tovid',
    category: 'media',
    aliases: ['tovideo', 'tomp4'],
    description: 'Re-send a video as a normal video (from a view-once)',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.videoMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a video with .tovid') }, { quoted: m });
        }
        try {
            const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            await conn.sendMessage(from, {
                video: buffer,
                caption: quoted.videoMessage.caption || '',
                mimetype: 'video/mp4'
            }, { quoted: m });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m });
        }
    }
};
