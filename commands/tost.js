// commands/tost.js
// Post text, image, video, or audio directly to WhatsApp Status.
// Owner only.
// Usage:
//   .tost Hello world!                  (Text status)
//   .tost https://site.com/img.jpg      (Image status from URL)
//   (reply to an image) .tost My caption (Image status from reply)
//   (reply to a video) .tost            (Video status from reply)
//   (reply to a voice note) .tost       (Voice note status from reply)

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'tost',
    category: 'owner',
    aliases: ['status', 'poststatus'],
    description: 'Post to WhatsApp Status (text, image, video, audio)',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // The status broadcast JID
        const statusJid = 'status@broadcast';

        // Helper to send to status
        const sendStatus = async (content) => {
            try {
                await conn.sendMessage(statusJid, content, { statusJidList: [conn.user.id] });
                return true;
            } catch (e) {
                console.error('[tost] send failed:', e.message);
                return false;
            }
        };

        // --- 1. FROM QUOTED MEDIA ---
        if (quoted) {
            let type = Object.keys(quoted)[0];
            
            // Unwrap viewOnce/ephemeral
            let inner = quoted;
            let guard = 0;
            while (guard++ < 5) {
                if (inner.ephemeralMessage?.message) { inner = inner.ephemeralMessage.message; continue; }
                if (inner.viewOnceMessage?.message) { inner = inner.viewOnceMessage.message; continue; }
                if (inner.viewOnceMessageV2?.message) { inner = inner.viewOnceMessageV2.message; continue; }
                break;
            }
            type = Object.keys(inner)[0];

            const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading to post to status...') }, { quoted: msg });

            try {
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendStatus({ image: buffer, caption: text || inner.imageMessage.caption || '' });
                } 
                else if (type === 'videoMessage') {
                    const stream = await downloadContentFromMessage(inner.videoMessage, 'video');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendStatus({ video: buffer, caption: text || inner.videoMessage.caption || '' });
                } 
                else if (type === 'audioMessage') {
                    const stream = await downloadContentFromMessage(inner.audioMessage, 'audio');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendStatus({ audio: buffer, mimetype: 'audio/mp4', ptt: true });
                } 
                else {
                    await conn.sendMessage(from, { text: fancy('❌ Unsupported reply type. Reply to an image, video, or voice note.'), edit: wait.key });
                    return;
                }

                await conn.sendMessage(from, { text: fancy('✅ Posted to your Status!'), edit: wait.key });
                return;

            } catch (e) {
                await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
                return;
            }
        }

        // --- 2. FROM URL ---
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = text.match(urlRegex);

        if (urlMatch) {
            const url = urlMatch[0];
            const isVideo = /\.(mp4|mkv|webm)(\?.*)?$/i.test(url);
            const isImage = /\.(jpe?g|png|webp)(\?.*)?$/i.test(url);

            if (isVideo) {
                await sendStatus({ video: { url }, caption: text.replace(url, '').trim() });
                return conn.sendMessage(from, { text: fancy('✅ Video posted to Status!') }, { quoted: msg });
            } else if (isImage) {
                await sendStatus({ image: { url }, caption: text.replace(url, '').trim() });
                return conn.sendMessage(from, { text: fancy('✅ Image posted to Status!') }, { quoted: msg });
            }
        }

        // --- 3. TEXT ONLY ---
        if (text) {
            const ok = await sendStatus({ 
                text,
                backgroundColor: '#000000',
                font: 1
            });
            if (ok) return conn.sendMessage(from, { text: fancy('✅ Text posted to Status!') }, { quoted: msg });
            return conn.sendMessage(from, { text: fancy('❌ Failed to post text status.') }, { quoted: msg });
        }

        // --- USAGE ---
        return conn.sendMessage(from, { 
            text: fancy(`Usage:\n${config.prefix}tost <text>\n${config.prefix}tost <image_url>\nReply to media with ${config.prefix}tost`) 
        }, { quoted: msg });
    }
};

// Helper to convert stream to array of chunks
async function streamToArray(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return chunks;
}