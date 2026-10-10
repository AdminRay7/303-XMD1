const { fancy } = require('../lib/font');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: 'vv',
    category: 'tools',
    aliases: ['viewonce', 'reveal'],
    description: 'Reveal a view-once image/video',
    async execute(conn, msg, args, ctx) {
        const { from, msg: m } = ctx;
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return conn.sendMessage(from, { text: fancy('❌ Reply to a view-once message.') }, { quoted: m });
        const type = Object.keys(quoted)[0];
        const inner = quoted[type]?.viewOnce;
        if (!inner) return conn.sendMessage(from, { text: fancy('❌ Not a view-once message.') }, { quoted: m });
        try {
            const kind = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : null;
            if (!kind) return conn.sendMessage(from, { text: fancy('❌ Unsupported type.') }, { quoted: m });
            const stream = await downloadContentFromMessage(quoted[type], kind);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buffer = Buffer.concat(chunks);
            const content = kind === 'image'
                ? { image: buffer, caption: quoted[type]?.caption || '' }
                : { video: buffer, caption: quoted[type]?.caption || '' };
            await conn.sendMessage(from, content, { quoted: m });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: m }); }
    }
};
