// commands/togcst.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'togcst',
    category: 'owner',
    description: 'Post to Group Status',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isOwner || !isGroup) return;

        const text = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (quoted) {
            let inner = quoted;
            const type = Object.keys(inner)[0];
            const wait = await conn.sendMessage(from, { text: fancy('📥 Downloading...') }, { quoted: msg });

            try {
                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await conn.sendGroupStatus(from, { image: buffer, caption: text });
                } else if (type === 'videoMessage') {
                    const stream = await downloadContentFromMessage(inner.videoMessage, 'video');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await conn.sendGroupStatus(from, { video: buffer, caption: text });
                } else if (type === 'audioMessage') {
                    const stream = await downloadContentFromMessage(inner.audioMessage, 'audio');
                    const buffer = Buffer.concat(await streamToArray(stream));
                    await conn.sendGroupStatus(from, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
                }
                await conn.sendMessage(from, { text: fancy('✅ Posted to Group Status!'), edit: wait.key });
            } catch (e) {
                await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
            }
            return;
        }

        if (text) {
            await conn.sendGroupStatus(from, { text });
            return conn.sendMessage(from, { text: fancy('✅ Text posted to Group Status!') }, { quoted: msg });
        }
    }
};