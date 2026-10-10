const { fancy } = require('../../lib/font');
module.exports = {
    name: 'antilink',
    category: 'auto',
    tags: ['security', 'group'],
    description: 'Delete links posted in groups',
    enabled: (cfg) => cfg.antilink === true,
    async onMessage(conn, msg, ctx) {
        if (!ctx.isGroup || ctx.isOwner) return false;
        if (!/https?:\/\//gi.test(ctx.body || '')) return false;
        try {
            await conn.sendMessage(ctx.from, { delete: msg.key });
            await conn.sendMessage(ctx.from, {
                text: fancy('⚠️ ᴀɴᴛɪʟɪɴᴋ\nLinks are not allowed here.'),
                mentions: [ctx.sender]
            });
        } catch {}
        return true;
    }
};
