const EMOJIS = ['🔑','🔥','⭐','✨','💯','❤️','👍','🎯'];
module.exports = {
    name: 'autoreact',
    category: 'auto',
    tags: ['automation'],
    description: 'React to every DM with random emoji',
    enabled: (cfg) => cfg.autoReact === true,
    async onMessage(conn, msg, ctx) {
        if (msg.key.fromMe || ctx.isGroup || ctx.isCmd) return false;
        try {
            const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            await conn.sendMessage(ctx.from, { react: { text: emoji, key: msg.key } });
        } catch {}
        return false;
    }
};
