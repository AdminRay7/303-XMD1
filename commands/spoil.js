const { fancy } = require('../lib/font');
module.exports = {
    name: 'spoil',
    category: 'text',
    aliases: ['spoiler', 'sp'],
    description: 'Wrap text in a WhatsApp spoiler',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .spoil secret message') }, { quoted: msg });
        await conn.sendMessage(from, {
            text: `🔒 Spoiler:\n\n||${text}||`
        }, { quoted: msg });
    }
};
