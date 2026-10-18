// commands/tost.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'tost',
    category: 'owner',
    aliases: ['status', 'poststatus'],
    description: 'Post to WhatsApp Status',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const statusJid = 'status@broadcast';

        // 1. FROM QUOTED MEDIA
        if (quoted) {
            let inner = quoted;
            let guard = 0;
            while (guard++ < 5) {
                if (inner.ephemeralMessage?.message) { inner = inner.ephemeralMessage.message; continue; }
                if (inner.viewOnceMessage?.message) { inner = inner.viewOnceMessage.message; continue; }
                break;
            }
            const type = Object.keys(inner)[0];
            const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading...') }, { quoted: msg });

            try {
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await conn.sendMessage(statusJid, { image: buffer, caption: text }, { statusJidList: [conn.user.id] });
                } else if (type === 'videoMessage') {
                    const stream = await downloadContentFromMessage(inner.videoMessage, 'video');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await conn.sendMessage(statusJid, { video: buffer, caption: text }, { statusJidList: [conn.user.id] });
                } else if (type === 'audioMessage') {
                    const stream = await downloadContentFromMessage(inner.audioMessage, 'audio');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    // Important: ptt: true and backgroundColor are REQUIRED for mobile visibility [citation:9]
                    await conn.sendMessage(statusJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, { statusJidList: [conn.user.id], backgroundColor: '#000000' });
                }
                await conn.sendMessage(from, { text: fancy('✅ Posted to Status!'), edit: wait.key });
            } catch (e) {
                await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
            }
            return;
        }

        // 2. TEXT ONLY (Requires backgroundColor)
        if (text) {
            await conn.sendMessage(statusJid, { 
                text, 
                backgroundColor: '#000000', // Required for text status [citation:4]
                font: 1 
            }, { statusJidList: [conn.user.id] });
            return conn.sendMessage(from, { text: fancy('✅ Text posted to Status!') }, { quoted: msg });
        }
    }
};

async function streamToArray(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return chunks;
}