// commands/owner.js
// Show owner + bot info.
// Usage: .owner

const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'owner',
    category: 'general',
    aliases: ['dev', 'creator'],
    description: 'Show bot owner contact',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;

        const ownerNumber = String(config.ownerNumber || '').replace(/\D/g, '') || 'N/A';
        const ownerName   = config.ownerName || 'Mr Presenter';
        const botName     = config.botName || '303-XMD';

        const text =
`🔑 *${fancy(botName)}* — Owner Info

👤 *Name:*  ${ownerName}
📞 *Number:*  wa.me/${ownerNumber}

📢 *Channel:*  Follow for updates

💡 Tap the number above to open a chat.

_${fancy(config.footer || '303-XMD — THE LAST KEY')}_`;

        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};