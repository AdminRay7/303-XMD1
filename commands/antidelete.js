const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'antidelete',
    category: 'auto',
    aliases: [],
    description: 'Toggle anti-delete',
    toggleKey: 'antidelete',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (isGroup) {
            try {
                const meta = await conn.groupMetadata(from);
                const botBare = String(conn.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
                const me = meta.participants.find(p => String(p.id).split('@')[0].split(':')[0].replace(/\D/g, '') === botBare);
                if (!me || (me.admin !== 'admin' && me.admin !== 'superadmin')) {
                    return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
                }
            } catch { return conn.sendMessage(from, { text: fancy('❌ Cannot read group info.') }); }
        }
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'antidelete', scope, config.antidelete === true);
            return conn.sendMessage(from, { text: fancy(`🗑️ Anti-Delete: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}antidelete on|off`) });
        await autoToggles.set(userId, 'antidelete', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Anti-Delete ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};