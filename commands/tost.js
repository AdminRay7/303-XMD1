// commands/tost.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'tost',
    category: 'owner',
    aliases: ['status', 'poststatus'],
    description: 'Post to WhatsApp Status (Reply to media)',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const statusJid = 'status@broadcast';

        // 1. TEXT ONLY (If no media is replied)
        if (!quoted) {
            if (!text) {
                return conn.sendMessage(from, { 
                    text: fancy(`Reply to a photo, video, or voice note with ${config.prefix}tost\nOr type ${config.prefix}tost <text>`) 
                }, { quoted: msg });
            }

            try {
                await conn.sendMessage(statusJid, { 
                    text, 
                    backgroundColor: '#000000', 
                    font: 1 
                }, { statusJidList: [conn.user.id] });
                return conn.sendMessage(from, { text: fancy('✅ Text posted to Status!') }, { quoted: msg });
            } catch (e) {
                return conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`) }, { quoted: msg });
            }
        }

        // 2. MEDIA REPLIED (Photo, Video, Voice Note)
        const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading media to status...') }, { quoted: msg });

        try {
            // Create a fake message object to trigger Baileys' native downloader
            const quotedMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                },
                message: quoted
            };

            // Force download to Buffer
            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { logger: console }
            );

            // Detect the message type
            const type = Object.keys(quoted)[0];
            const inner = quoted[type];

            if (type === 'imageMessage') {
                await conn.sendMessage(statusJid, { 
                    image: buffer, 
                    caption: text || inner.caption || '' 
                }, { statusJidList: [conn.user.id] });
            } 
            else if (type === 'videoMessage') {
                await conn.sendMessage(statusJid, { 
                    video: buffer, 
                    caption: text || inner.caption || '' 
                }, { statusJidList: [conn.user.id] });
            } 
            else if (type === 'audioMessage') {
                await conn.sendMessage(statusJid, { 
                    audio: buffer, 
                    mimetype: 'audio/mp4', 
                    ptt: true 
                }, { statusJidList: [conn.user.id] });
            } 
            else {
                await conn.sendMessage(from, { text: fancy('❌ Unsupported media type.'), edit: wait.key });
                return;
            }

            await conn.sendMessage(from, { text: fancy('✅ Posted to Status!'), edit: wait.key });

        } catch (e) {
            console.error('[tost] error:', e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};