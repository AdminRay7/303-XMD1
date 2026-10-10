const { fancy } = require('../../lib/font');
module.exports = {
    name: 'antimedia',
    category: 'auto',
    tags: ['security', 'group'],
    description: 'Block media types in groups',
    enabled: (cfg) => cfg.antimedia && cfg.antimedia !== 'off',
    async onMessage(conn, msg, ctx) {
        if (!ctx.isGroup || ctx.isOwner) return false;
        const type = Object.keys(msg.message || {})[0];
        const map = { imageMessage: 'photo', videoMessage: 'video', stickerMessage: 'sticker' };
        const mode = ctx.config.antimedia;
        const matched = map[type];
        if (!matched) return false;
        if (mode !== 'all' && mode !== matched) return false;
        try {
            await conn.sendMessage(ctx.from, { delete: msg.key });
            await conn.sendMessage(ctx.from, {
                text: fancy(`🚫 ᴀɴᴛɪᴍᴇᴅɪᴀ\n${matched} not allowed here.`),
                mentions: [ctx.sender]
            });
        } catch {}
        return true;
    }
};
