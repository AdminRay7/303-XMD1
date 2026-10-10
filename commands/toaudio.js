const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'toaudio',
    category: 'media',
    aliases: ['tomp3'],
    description: 'Extract audio from a video',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const type = Object.keys(m.message || {})[0];
        const mediaMsg = quoted && quoted.videoMessage ? quoted : m.message;
        if (!mediaMsg.videoMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a video with .toaudio') }, { quoted: m });
        }
        try {
            const stream = await downloadContentFromMessage(mediaMsg.videoMessage, 'video');
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: m });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m });
        }
    }
};
