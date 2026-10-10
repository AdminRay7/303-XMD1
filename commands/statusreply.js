module.exports = {
    name: 'statusreply',
    category: 'auto',
    tags: ['status'],
    description: 'Auto-reply to statuses',
    enabled: (cfg) => cfg.autoStatus?.reply === true,
    async onMessage(conn, msg, ctx) {
        if (!ctx.isStatus || msg.key.fromMe) return false;
        const text = ctx.config.statusReplyText || 'Nice status! ✨';
        try { await conn.sendMessage(ctx.from, { text }, { quoted: msg }); } catch {}
        return true;
    }
};
