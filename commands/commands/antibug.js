const { fancy } = require('../../lib/font');
const BUG_PATTERNS = [
    '\u200e', '\u200f', '\u202e', '\u202a', '\u202b', '\u202c', '\u202d',
    /[\u2066-\u2069]/g, /[\u2000-\u200F]/g, /[\u2028-\u202F]/g
];
module.exports = {
    name: 'antibug',
    category: 'auto',
    tags: ['security'],
    description: 'Block malicious unicode',
    enabled: (cfg) => cfg.antibug === true,
    async onMessage(conn, msg, ctx) {
        const body = ctx.body || '';
        if (!body) return false;
        const hasBug = BUG_PATTERNS.some(p => typeof p === 'string' ? body.includes(p) : (p.lastIndex = 0, p.test(body)));
        if (!hasBug) return false;
        try {
            await conn.sendMessage(ctx.from, { delete: msg.key });
            await conn.sendMessage(ctx.from, {
                text: fancy(`🚫 ʙᴜɢ ᴅᴇᴛᴇᴄᴛᴇᴅ\n@${ctx.sender.split('@')[0]} sent malicious content`),
                mentions: [ctx.sender]
            });
        } catch {}
        return true;
    }
};
