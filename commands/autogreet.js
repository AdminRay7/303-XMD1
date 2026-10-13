const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autogreet',
    category: 'auto',
    aliases: [],
    description: 'Toggle autogreet',
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
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autogreet on|off`) });
        }
        const scope = isGroup ? from : null;
        if (action === '') {
            const current = await autoToggles.get(ctx.userId, 'autogreet', scope, config.autoGreet === true);
            return conn.sendMessage(from, { text: fancy(`🙋 autogreet: ${current ? '✅ ON' : '❌ OFF'}`) });
        }
        const value = action === 'on';
        await autoToggles.set(ctx.userId, 'autogreet', scope, value);
        return conn.sendMessage(from, { text: fancy(`✅ autogreet ${value ? 'ENABLED' : 'DISABLED'}.`) });
    }
};
