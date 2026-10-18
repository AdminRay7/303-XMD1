// commands/togcst.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'togcst',
    category: 'owner',
    aliases: ['groupstatus', 'gcstatus'],
    description: 'Post to Group Status (Reply to media)',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Use this inside a group.') });

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            if (!text) return;
            try {
                await conn.sendMessage(from, { text, groupStatus: true });
                return conn.sendMessage(from, { text: fancy('✅ Text posted to Group Status!') }, { quoted: msg });
            } catch (e) {
                return conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`) }, { quoted: msg });
            }
        }

        const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading media...') }, { quoted: msg });

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

            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { logger: console }
            );

            const type = Object.keys(quoted)[0];
            const inner = quoted[type];

            if (type === 'imageMessage') {
                await conn.sendMessage(from, { image: buffer, caption: text || inner.caption || '', groupStatus: true });
            } 
            else if (type === 'videoMessage') {
                await conn.sendMessage(from, { video: buffer, caption: text || inner.caption || '', groupStatus: true });
            } 
            else if (type === 'audioMessage') {
                await conn.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4', ptt: true, groupStatus: true });
            } 
            else {
                await conn.sendMessage(from, { text: fancy('❌ Unsupported media.'), edit: wait.key });
                return;
            }

            await conn.sendMessage(from, { text: fancy('✅ Posted to Group Status!'), edit: wait.key });

        } catch (e) {
            console.error('[togcst] error:', e);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};