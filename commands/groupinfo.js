const { fancy } = require('../lib/font');
module.exports = {
    name: 'groupinfo',
    category: 'group',
    aliases: ['ginfo', 'group'],
    description: 'Show info about the current group',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        try {
            const meta = await conn.groupMetadata(from);
            const created = meta.creation ? new Date(meta.creation * 1000).toLocaleString() : 'unknown';
            const admins = meta.participants.filter(p => p.admin).length;
            const text =
                `╭─〔 📋 ɢʀᴏᴜᴘ ɪɴꜰᴏ 〕\n│\n` +
                `│ 📛 Name:  ${meta.subject}\n│ 🆔 JID:   ${from}\n` +
                `│ 👥 Members: ${meta.participants.length}\n│ 👑 Admins:  ${admins}\n` +
                `│ 📅 Created: ${created}\n│ 📝 Desc:  ${(meta.desc || 'none').slice(0, 100)}\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
