const { fancy } = require('../lib/font');
module.exports = {
    name: 'kick',
    category: 'admin',
    aliases: ['remove'],
    description: 'Remove a member from the group',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant ||
                       msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!target) return conn.sendMessage(from, { text: fancy('❌ Reply to a message or mention the user to kick.') });
        try {
            await conn.groupParticipantsUpdate(from, [target], 'remove');
            await conn.sendMessage(from, { text: fancy(`✅ Removed @${target.split('@')[0]}`), mentions: [target] });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
