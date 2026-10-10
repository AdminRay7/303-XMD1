const { User } = require('../../database/models');
const pendingSaves = new Map();
setInterval(async () => {
    for (const [, u] of pendingSaves) { try { await u.save(); } catch {} }
    pendingSaves.clear();
}, 30000).unref();
module.exports = {
    name: 'antispam',
    category: 'auto',
    tags: ['security'],
    description: 'Auto-remove or block spammers',
    enabled: (cfg) => cfg.antispam === true,
    async onMessage(conn, msg, ctx) {
        if (ctx.isOwner || msg.key.fromMe) return false;
        try {
            let user = await User.findOne({ jid: ctx.sender });
            const now = Date.now();
            if (!user) {
                user = new User({ jid: ctx.sender, name: ctx.pushname, sessionId: ctx.userId,
                    messageCount: 1, spamCount: 0, lastMessageTime: now, lastActive: new Date() });
                pendingSaves.set(user.jid, user);
                return false;
            }
            const diff = now - (user.lastMessageTime || 0);
            if (diff < 60000) {
                user.spamCount = (user.spamCount || 0) + 1;
                if (user.spamCount >= 5) {
                    if (ctx.isGroup) {
                        await conn.groupParticipantsUpdate(ctx.from, [ctx.sender], 'remove');
                        await conn.sendMessage(ctx.from, { text: '🚫 ꜱᴘᴀᴍᴍᴇʀ ʀᴇᴍᴏᴠᴇᴅ', mentions: [ctx.sender] });
                    } else {
                        await conn.updateBlockStatus(ctx.sender, 'block');
                    }
                    user.spamCount = 0;
                }
            } else user.spamCount = 0;
            user.lastMessageTime = now;
            pendingSaves.set(user.jid, user);
        } catch (e) { console.error('antispam:', e.message); }
        return false;
    }
};
