const { fancy } = require('../lib/font');
module.exports = {
    name: 'demote',
    category: 'admin',
    aliases: ['rmadmin'],
    description: 'Remove admin from a member',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant ||
                       msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) return conn.sendMessage(from, { text: fancy('❌ Reply or mention a user.') });
        try {
            await conn.groupParticipantsUpdate(from, [target], 'demote');
            await conn.sendMessage(from, { text: fancy(`⬇️ Demoted @${target.split('@')[0]}`), mentions: [target] });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
