const { fancy } = require('../lib/font');
module.exports = {
    name: 'setname',
    category: 'group',
    aliases: ['renamegroup'],
    description: 'Change the group name',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const name = args.join(' ').trim();
        if (!name) return conn.sendMessage(from, { text: fancy('❌ Usage: .setname New Name') });
        try {
            await conn.groupUpdateSubject(from, name);
            await conn.sendMessage(from, { text: fancy(`✅ Group renamed to: ${name}`) });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
