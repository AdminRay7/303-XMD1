const { fancy } = require('../../lib/font');
module.exports = {
    name: 'welcome',
    category: 'auto',
    tags: ['group'],
    description: 'Welcome new group members',
    enabled: (cfg) => cfg.welcomeMessage === true,
    async onGroupJoin(conn, groupJid, participants) {
        for (const p of participants) {
            try {
                const tag = '@' + p.split('@')[0];
                const text = fancy(`👋 ᴡᴇʟᴄᴏᴍᴇ ${tag}\n\nGlad to have you here!\nRead the group rules and enjoy.`);
                await conn.sendMessage(groupJid, { text, mentions: [p] });
            } catch (e) { console.error('welcome:', e.message); }
        }
    }
};
