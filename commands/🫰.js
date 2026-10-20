// commands/🫰.js
// Reveals View-Once media.
// Usage: Reply to any view-once photo/video with .🫰

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: '🫰',
    category: 'tools',
    aliases: ['vv', 'viewonce'],
    description: 'Reveal a view-once message',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;

        // Owner only (so random users can't abuse it)
        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        // 1. Get the quoted message
        const msgContext = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = msgContext?.quotedMessage;

        if (!quoted) {
            return conn.sendMessage(from, { 
                text: fancy(`❌ Reply to a view-once photo/video with ${config.prefix}🫰`) 
            }, { quoted: msg });
        }

        // 2. Unwrap the view-once container
        let inner = quoted;
        let guard = 0;
        while (guard++ < 5) {
            if (inner.viewOnceMessage?.message) { inner = inner.viewOnceMessage.message; continue; }
            if (inner.viewOnceMessageV2?.message) { inner = inner.viewOnceMessageV2.message; continue; }
            if (inner.viewOnceMessageV2Extension?.message) { inner = inner.viewOnceMessageV2Extension.message; continue; }
            if (inner.ephemeralMessage?.message) { inner = inner.ephemeralMessage.message; continue; }
            break;
        }

        const type = Object.keys(inner)[0];
        
        // 3. Validate it's actual media
        if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
            return conn.sendMessage(from, { 
                text: fancy('❌ The replied message is not a view-once photo, video, or audio.') 
            }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('📥 Revealing...') }, { quoted: msg });

        try {
            // 4. Download the media buffer
            const quotedMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: msgContext.stanzaId,
                    participant: msgContext.participant
                },
                message: quoted
            };

            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });

            // 5. Send it back as normal media
            if (type === 'imageMessage') {
                await conn.sendMessage(from, { 
                    image: buffer, 
                    caption: fancy('✅ *View-Once Revealed*') 
                }, { quoted: msg });
            } else if (type === 'videoMessage') {
                await conn.sendMessage(from, { 
                    video: buffer, 
                    caption: fancy('✅ *View-Once Revealed*') 
                }, { quoted: msg });
            } else if (type === 'audioMessage') {
                await conn.sendMessage(from, { 
                    audio: buffer, 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                }, { quoted: msg });
            }

            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}

        } catch (e) {
            console.error('[viewonce] error:', e.message);
            await conn.sendMessage(from, { 
                text: fancy(`❌ Failed to reveal: ${e.message}`), 
                edit: wait.key 
            });
        }
    }
};