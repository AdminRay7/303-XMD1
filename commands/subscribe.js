const { ChannelSubscriber } = require('../../database/models');
const { fancy } = require('../../lib/font');
const cache = new Set();
module.exports = {
    name: 'autosubscribe',
    category: 'auto',
    tags: ['channel'],
    description: 'Auto-subscribe users to channel',
    enabled: (cfg) => !!cfg.channelLink,
    async onMessage(conn, msg, ctx) {
        if (ctx.isOwner || ctx.isGroup || msg.key.fromMe) return false;
        if (cache.has(ctx.sender)) return false;
        try {
            const existing = await ChannelSubscriber.findOne({ jid: ctx.sender, isActive: true });
            if (existing) { cache.add(ctx.sender); return false; }
            await ChannelSubscriber.create({
                jid: ctx.sender, name: ctx.pushname,
                subscribedAt: new Date(), isActive: true, autoFollow: true
            });
            cache.add(ctx.sender);
            await conn.sendMessage(ctx.from, {
                text: fancy(`✅ Auto-subscribed!\n\n🔗 ${ctx.config.channelLink}`)
            });
        } catch {}
        return false;
    }
};
