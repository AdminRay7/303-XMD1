const { fancy } = require('../../lib/font');
module.exports = {
    name: 'goodbye',
    category: 'auto',
    tags: ['group'],
    description: 'Farewell leaving members',
    enabled: (cfg) => cfg.goodbyeMessage !== false,
    async onGroupLeave(conn, groupJid, participants) {
        for (const p of participants) {
            try {
                const tag = '@' + p.split('@')[0];
                const text = fancy(`👋 ɢᴏᴏᴅʙʏᴇ ${tag}\n\nSee you next time!`);
                await conn.sendMessage(groupJid, { text, mentions: [p] });
            } catch (e) { console.error('goodbye:', e.message); }
        }
    }
};
