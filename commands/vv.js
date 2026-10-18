// commands/vv.js
// Reveal / save View-Once media (photo, video, audio).
// Usage: Reply to a View-Once message with .vv
//
// Rules:
//   - Cannot reveal your own outgoing view-once
//   - Works in DMs and groups
//   - Owner-only (to prevent abuse)

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

// Unwrap nested message types (view-once, ephemeral)
function unwrap(msg) {
    let inner = msg.message || {};
    let guard = 0;
    while (guard++ < 5) {
        if (inner.ephemeralMessage?.message) { inner = inner.ephemeralMessage.message; continue; }
        if (inner.viewOnceMessage?.message) { inner = inner.viewOnceMessage.message; continue; }
        if (inner.viewOnceMessageV2?.message) { inner = inner.viewOnceMessageV2.message; continue; }
        if (inner.viewOnceMessageV2Extension?.message) { inner = inner.viewOnceMessageV2Extension.message; continue; }
        break;
    }
    return inner;
}

module.exports = {
    name: 'vv',
    category: 'tools',
    aliases: ['viewonce', 'reveal'],
    description: 'Reveal a view-once message (reply to it)',
    
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;

        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        // Extract quoted message
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return conn.sendMessage(from, { 
                text: fancy(`❌ Reply to a View-Once message with ${config.prefix}vv`) 
            }, { quoted: msg });
        }

        // Unwrap the quoted message to find the media
        const inner = unwrap({ message: quoted });
        const type = Object.keys(inner)[0];

        let mediaType = null;
        let mediaMessage = null;

        if (type === 'imageMessage') { mediaType = 'image'; mediaMessage = inner.imageMessage; }
        else if (type === 'videoMessage') { mediaType = 'video'; mediaMessage = inner.videoMessage; }
        else if (type === 'audioMessage') { mediaType = 'audio'; mediaMessage = inner.audioMessage; }

        if (!mediaType || !mediaMessage) {
            return conn.sendMessage(from, { 
                text: fancy('❌ The replied message is not a View-Once photo, video, or audio.') 
            }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading...') }, { quoted: msg });

        try {
            // Download the media
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);

            await conn.sendMessage(from, { text: fancy('📤 Sending...'), edit: wait.key });

            // Send it back as a normal message
            if (mediaType === 'image') {
                await conn.sendMessage(from, { 
                    image: buffer, 
                    caption: fancy('✅ View-Once Revealed') 
                }, { quoted: msg });
            } else if (mediaType === 'video') {
                await conn.sendMessage(from, { 
                    video: buffer, 
                    caption: fancy('✅ View-Once Revealed') 
                }, { quoted: msg });
            } else if (mediaType === 'audio') {
                await conn.sendMessage(from, { 
                    audio: buffer, 
                    mimetype: 'audio/mp4',
                    ptt: false 
                }, { quoted: msg });
                await conn.sendMessage(from, { 
                    text: fancy('✅ View-Once Audio Revealed') 
                }, { quoted: msg });
            }

            // Delete the "Downloading..." message
            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}

        } catch (e) {
            console.error('[vv] error:', e.message);
            await conn.sendMessage(from, { 
                text: fancy(`❌ Failed: ${e.message}`), 
                edit: wait.key 
            });
        }
    }
};