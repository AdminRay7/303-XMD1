const { fancy } = require('../lib/font');
module.exports = {
    name: 'mute',
    category: 'admin',
    aliases: ['close'],
    description: 'Close the group (admins only can send)',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        try {
            await conn.groupSettingUpdate(from, 'announcement');
            await conn.sendMessage(from, { text: fancy('🔇 Group muted — admins only.') });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
