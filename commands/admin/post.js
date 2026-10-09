const config = require('../config');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'post',
    aliases: ['publish', 'channelpost'],
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!args.length) return conn.sendMessage(from, { text: fancy(`❌ Usage: ${config.prefix}post <text>`) });
        const text = args.join(' ');
        try {
            await conn.sendMessage(config.newsletterJid, { text });
            await conn.sendMessage(from, { text: fancy('✅ Posted to channel.') });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`) });
        }
    }
};