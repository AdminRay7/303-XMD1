module.exports = {
    name: 'autoblock',
    category: 'auto',
    tags: ['security'],
    description: 'Block senders from certain country codes',
    enabled: (cfg) => Array.isArray(cfg.autoblock) && cfg.autoblock.length > 0,
    async onMessage(conn, msg, ctx) {
        if (ctx.isOwner) return false;
        const cc = ctx.sender.split('@')[0].substring(0, 3).replace('+', '');
        if (!ctx.config.autoblock.includes(cc)) return false;
        try { await conn.updateBlockStatus(ctx.sender, 'block'); } catch {}
        return true;
    }
};
