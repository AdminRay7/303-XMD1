const EMOJIS = ['❤️','💚','💙','💛','🧡','💜','🔥','👍','😍','✨'];
module.exports = {
    name: 'statuslike',
    category: 'auto',
    tags: ['status'],
    description: 'Auto-react to statuses',
    enabled: (cfg) => cfg.autoStatus?.like === true,
    async onMessage(conn, msg, ctx) {
        if (!ctx.isStatus || msg.key.fromMe) return false;
        try {
            const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            await conn.sendMessage('status@broadcast', { react: { text: emoji, key: msg.key } });
        } catch {}
        return false;
    }
};
