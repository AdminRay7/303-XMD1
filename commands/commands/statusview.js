module.exports = {
    name: 'statusview',
    category: 'auto',
    tags: ['status'],
    description: 'Auto-view statuses',
    enabled: (cfg) => cfg.autoStatus?.view === true,
    async onMessage(conn, msg, ctx) {
        if (!ctx.isStatus) return false;
        try { await conn.readMessages([msg.key]); } catch {}
        return false;
    }
};
