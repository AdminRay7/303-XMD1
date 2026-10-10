const { fancy } = require('../lib/font');
module.exports = {
    name: 'link',
    category: 'group',
    aliases: ['invite', 'gclink'],
    description: 'Get the group invite link',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        try {
            const code = await conn.groupInviteCode(from);
            await conn.sendMessage(from, { text: fancy(`🔗 ɢʀᴏᴜᴘ ʟɪɴᴋ\n\n`) + `https://chat.whatsapp.com/${code}` });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
