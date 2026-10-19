// commands/tovideo.js
// Convert a replied sticker back to an image or video.
// Usage: (reply to a sticker) .toimage  OR  .tovideo

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'toimg',
    category: 'tools',
    aliases: ['tovideo', 'unsticker'],
    description: 'Convert sticker to image or video',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a sticker with .toimg or .tovideo') }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🔄 Converting...') }, { quoted: msg });
        const isVideo = quoted.stickerMessage.isAnimated || false;

        try {
            const quotedMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                },
                message: quoted
            };
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });

            if (isVideo) {
                await conn.sendMessage(from, { video: buffer, caption: fancy('✅ Converted from sticker') }, { quoted: msg });
            } else {
                await conn.sendMessage(from, { image: buffer, caption: fancy('✅ Converted from sticker') }, { quoted: msg });
            }

            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}
        } catch (e) {
            console.error('[toimg] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};