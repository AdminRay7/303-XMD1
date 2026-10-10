module.exports = {
    name: 'autoread',
    category: 'auto',
    tags: ['automation'],
    description: 'Auto-read incoming DMs',
    enabled: (cfg) => cfg.autoRead === true,
    async onMessage(conn, msg, ctx) {
        if (msg.key.fromMe || ctx.isGroup) return false;
        try { await conn.readMessages([msg.key]); } catch {}
        return false;
    }
};
