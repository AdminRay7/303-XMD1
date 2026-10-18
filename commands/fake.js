// commands/fake.js
// Generate a fake chat image.
// Usage: .fake <text>
// Example: .fake Hello World

const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'fake',
    category: 'fun',
    aliases: ['fakechat'],
    description: 'Generate a fake chat bubble',
    async execute(conn, msg, args, ctx) {
        const { from, pushname } = ctx;
        const text = args.join(' ');

        if (!text) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}fake <text>`) }, { quoted: msg });
        }

        // Just a text-based fake chat representation
        const fakeChat = 
`╭─❖ *WhatsApp* ❖─╮
│
│ 👤 *${pushname}*
│
│ ${text}
│
│ 12:00 PM ✓✓
│
╰──────────────────╯

_Fake Chat Generated_`;

        await conn.sendMessage(from, { text: fakeChat }, { quoted: msg });
    }
};