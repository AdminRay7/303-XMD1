const { fancy } = require('../lib/font');
module.exports = {
    name: 'revoke',
    category: 'group',
    aliases: ['resetlink'],
    description: 'Reset the group invite link',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        try {
            await conn.groupRevokeInvite(from);
            await conn.sendMessage(from, { text: fancy('✅ Invite link reset.') });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
