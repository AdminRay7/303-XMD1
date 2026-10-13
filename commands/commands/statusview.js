const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'statusview',
    category: 'auto',
    aliases: [],
    description: 'Toggle statusview',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        falseif (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        false
        if (isGroup) {
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
        }
        
        const action = (args[0] || '').toLowerCase();
        if (!['on', 'off', ''].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusview on|off`) });
        }
        const scope = isGroup ? from : null;
        if (action === '') {
            const current = await autoToggles.get(ctx.userId, 'statusview', scope, config.autoStatusView === true);
            return conn.sendMessage(from, { text: fancy(`👁️ statusview: ${current ? '✅ ON' : '❌ OFF'}`) });
        }
        const value = action === 'on';
        await autoToggles.set(ctx.userId, 'statusview', scope, value);
        return conn.sendMessage(from, { text: fancy(`✅ statusview ${value ? 'ENABLED' : 'DISABLED'}.`) });
    }
};
