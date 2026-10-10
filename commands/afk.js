const { fancy } = require('../lib/font');
const afkUsers = new Map();   // jid -> { reason, since }

module.exports = {
    name: 'afk',
    category: 'misc',
    aliases: ['away'],
    description: 'Set yourself as AFK',
    afkUsers,

    async execute(conn, msg, args, ctx) {
        const { from, sender, pushname } = ctx;
        const reason = args.join(' ').trim() || 'no reason';

        if (afkUsers.has(sender)) {
            afkUsers.delete(sender);
            return conn.sendMessage(from, { text: fancy(`✅ Welcome back, ${pushname}! AFK removed.`) }, { quoted: msg });
        }

        afkUsers.set(sender, { reason, since: Date.now(), pushname });
        await conn.sendMessage(from, {
            text: fancy(`💤 ${pushname} is now AFK\nReason: ${reason}`)
        }, { quoted: msg });
    },

    // Auto-respond to AFK mentions
    async onMessage(conn, msg, ctx) {
        if (!ctx.isGroup) return false;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const text = ctx.body || '';
        for (const jid of mentioned) {
            const entry = afkUsers.get(jid);
            if (!entry) continue;
            const ago = Math.floor((Date.now() - entry.since) / 60000);
            await conn.sendMessage(ctx.from, {
                text: fancy(`💤 ${entry.pushname} is AFK — ${entry.reason} (${ago}m ago)`),
                mentions: [jid]
            }, { quoted: msg });
        }
        // If the AFK user themselves posts, remove AFK
        if (afkUsers.has(ctx.sender) && !msg.key.fromMe) {
            afkUsers.delete(ctx.sender);
            await conn.sendMessage(ctx.from, {
                text: fancy(`👋 Welcome back, ${ctx.pushname}! AFK removed.`)
            }, { quoted: msg });
        }
        return false;
    },

    enabled: () => true
};
