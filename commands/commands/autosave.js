const { User } = require('../../database/models');
const pending = new Map();
setInterval(async () => {
    for (const [, u] of pending) { try { await u.save(); } catch {} }
    pending.clear();
}, 30000).unref();
module.exports = {
    name: 'autosave',
    category: 'auto',
    tags: ['users'],
    description: 'Track user activity',
    enabled: (cfg) => cfg.autoSave === true,
    async onMessage(conn, msg, ctx) {
        if (ctx.isOwner || ctx.isGroup || msg.key.fromMe) return false;
        try {
            let user = await User.findOne({ jid: ctx.sender });
            if (!user) {
                user = new User({ jid: ctx.sender, name: ctx.pushname, sessionId: ctx.userId,
                    lastActive: new Date(), messageCount: 1 });
            } else {
                user.messageCount += 1;
                user.lastActive = new Date();
            }
            pending.set(user.jid, user);
        } catch {}
        return false;
    }
};
