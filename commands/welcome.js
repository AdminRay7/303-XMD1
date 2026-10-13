const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'welcome',
    category: 'auto',
    aliases: [],
    description: 'Toggle welcome message',
    toggleKey: 'welcome',
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
            const on = await autoToggles.get(userId, 'welcome', from, config.welcomeMessage === true);
            return conn.sendMessage(from, { text: fancy(`👋 Welcome: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}welcome on|off`) });
        await autoToggles.set(userId, 'welcome', from, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Welcome ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};