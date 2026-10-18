// commands/togcst.js
// Post text, image, video, or audio directly to a GROUP Status.
// Owner only.
// Usage:
//   .togcst Hello world!                  (Text status)
//   .togcst https://site.com/img.jpg      (Image status from URL)
//   (reply to an image) .togcst My caption (Image status from reply)
//   (reply to a video) .togcst            (Video status from reply)
//   (reply to a voice note) .togcst       (Voice note status from reply)

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'togcst',
    category: 'owner',
    aliases: ['groupstatus', 'gcstatus'],
    description: 'Post to Group WhatsApp Status',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }
        
        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ This command must be used inside a group.') });
        }

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // The GROUP status broadcast JID format is usually just the group JID
        // Baileys handles routing it to the group's status if we send to the group JID with groupStatus: true
        const groupJid = from;

        // Helper to send to group status
        const sendGroupStatus = async (content) => {
            try {
                // We must include groupStatus: true for Baileys to route it to the group's status ring
                await conn.sendMessage(groupJid, { ...content, groupStatus: true });
                return true;
            } catch (e) {
                console.error('[togcst] send failed:', e.message);
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

            const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading to post to group status...') }, { quoted: msg });

            try {
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendGroupStatus({ image: buffer, caption: text || inner.imageMessage.caption || '' });
                } 
                else if (type === 'videoMessage') {
                    const stream = await downloadContentFromMessage(inner.videoMessage, 'video');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendGroupStatus({ video: buffer, caption: text || inner.videoMessage.caption || '' });
                } 
                else if (type === 'audioMessage') {
                    const stream = await downloadContentFromMessage(inner.audioMessage, 'audio');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await sendGroupStatus({ audio: buffer, mimetype: 'audio/mp4', ptt: true });
                } 
                else {
                    await conn.sendMessage(from, { text: fancy('❌ Unsupported reply type. Reply to an image, video, or voice note.'), edit: wait.key });
                    return;
                }

                await conn.sendMessage(from, { text: fancy('✅ Posted to Group Status!'), edit: wait.key });
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
                await sendGroupStatus({ video: { url }, caption: text.replace(url, '').trim() });
                return conn.sendMessage(from, { text: fancy('✅ Video posted to Group Status!') }, { quoted: msg });
            } else if (isImage) {
                await sendGroupStatus({ image: { url }, caption: text.replace(url, '').trim() });
                return conn.sendMessage(from, { text: fancy('✅ Image posted to Group Status!') }, { quoted: msg });
            }
        }

        // --- 3. TEXT ONLY ---
        if (text) {
            const ok = await sendGroupStatus({ 
                text,
                backgroundColor: '#000000',
                font: 1
            });
            if (ok) return conn.sendMessage(from, { text: fancy('✅ Text posted to Group Status!') }, { quoted: msg });
            return conn.sendMessage(from, { text: fancy('❌ Failed to post text to group status.') }, { quoted: msg });
        }

        // --- USAGE ---
        return conn.sendMessage(from, { 
            text: fancy(`Usage:\n${config.prefix}togcst <text>\n${config.prefix}togcst <image_url>\nReply to media with ${config.prefix}togcst`) 
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