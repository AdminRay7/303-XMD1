const { fancy } = require('../lib/font');
module.exports = {
    name: 'tagall',
    category: 'admin',
    aliases: ['mentionall', 'everyone'],
    description: 'Mention every member of the group',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner)  return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        try {
            const meta = await conn.groupMetadata(from);
            const mentions = meta.participants.map(p => p.id);
            const note = args.join(' ') || 'Attention everyone!';
            const header = `📢 *${fancy('ᴛᴀɢ ᴀʟʟ')}*\n\n${note}\n\n`;
            const list = mentions.map(m => `◇ @${m.split('@')[0]}`).join('\n');
            await conn.sendMessage(from, { text: header + list, mentions });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }); }
    }
};
