const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'goodbye',
    category: 'auto',
    aliases: [],
    description: 'Toggle goodbye message',
    toggleKey: 'goodbye',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        try {
            const meta = await conn.groupMetadata(from);
            const botBare = String(conn.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
            const me = meta.participants.find(p => String(p.id).split('@')[0].split(':')[0].replace(/\D/g, '') === botBare);
            if (!me || (me.admin !== 'admin' && me.admin !== 'superadmin')) {
                return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
            }
        } catch { return conn.sendMessage(from, { text: fancy('❌ Cannot read group info.') }); }
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'goodbye', from, config.goodbyeMessage === true);
            return conn.sendMessage(from, { text: fancy(`👋 Goodbye: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}goodbye on|off`) });
        await autoToggles.set(userId, 'goodbye', from, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Goodbye ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};