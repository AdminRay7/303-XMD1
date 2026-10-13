const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'antimedia',
    category: 'auto',
    aliases: [],
    description: 'Toggle anti-media (off|all|photo|video|sticker)',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup)  return conn.sendMessage(from, { text: fancy('❌ Group only command.') });

        try {
            const meta = await conn.groupMetadata(from);
            const botJid = conn.user?.id?.split(':')[0] + '@s.whatsapp.net';
            const me = meta.participants.find(p => p.id === botJid || p.id === conn.user?.id);
            if (!me || (me.admin !== 'admin' && me.admin !== 'superadmin')) {
                return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to toggle this.') });
            }
        } catch (e) {
            return conn.sendMessage(from, { text: fancy('❌ Cannot read group info.') });
        }

        const valid = ['off', 'all', 'photo', 'video', 'sticker'];
        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const current = await autoToggles.get(ctx.userId, 'antimedia', from, config.antimedia || 'off');
            return conn.sendMessage(from, { text: fancy(`📵 antimedia: ${current}`) });
        }
        if (!valid.includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antimedia off|all|photo|video|sticker`) });
        }
        await autoToggles.set(ctx.userId, 'antimedia', from, action);
        return conn.sendMessage(from, { text: fancy(`✅ antimedia set to: ${action}`) });
    }
};
