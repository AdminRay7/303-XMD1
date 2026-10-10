const { fancy } = require('../lib/font');
module.exports = {
    name: 'fake',
    category: 'text',
    aliases: ['fakechat', 'fakequote'],
    description: 'Create a fake quoted message',
    async execute(conn, msg, args, ctx) {
        const { from, pushname } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .fake hello world') }, { quoted: msg });
        const fake = {
            key: {
                fromMe: true,
                participant: ctx.sender,
                remoteJid: from
            },
            message: {
                conversation: text
            },
            pushName: pushname
        };
        try {
            await conn.sendMessage(from, {
                text: `╭─〔 🎭 ꜰᴀᴋᴇ ᴄʜᴀᴛ 〕\n│\n│ ${text}\n│\n╰──────────────────────`,
                contextInfo: {
                    quotedMessage: { conversation: text },
                    participant: ctx.sender,
                    remoteJid: from
                }
            }, { quoted: msg });
        } catch {
            await conn.sendMessage(from, { text }, { quoted: msg });
        }
    }
};
