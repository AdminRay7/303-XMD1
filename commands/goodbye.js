// commands/goodbye.js
// Farewell message when members leave a group.
// Toggle: .goodbye on | off | (no args = show state)
// Scope: per-group

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

function bareNum(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function isBotGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botBare = bareNum(conn.user?.id);
        const botLidBare = bareNum(conn.user?.lid);
        const me = meta.participants.find(p => {
            const pidBare = bareNum(p.id);
            return pidBare === botBare || (botLidBare && pidBare === botLidBare);
        });
        if (!me) return false;
        return me.admin === 'admin' || me.admin === 'superadmin';
    } catch { return false; }
}

function buildGoodbyeText(groupName, members) {
    const mentions = members.map(m => `@${bareNum(m)}`).join(' ');

    return (
        `╭─〔 👋 ɢᴏᴏᴅʙʏᴇ 〕\n│\n` +
        `│ ${mentions} left *${groupName}*.\n` +
        `│\n` +
        `│ Take care — you're always welcome back.\n` +
        `│\n` +
        `╰──────────────────────\n\n` +
        `_${config.footer || '303-XMD — THE LAST KEY'}_`
    );
}

module.exports = {
    name: 'goodbye',
    category: 'auto',
    aliases: ['gb'],
    description: 'Farewell message for leaving group members',
    toggleKey: 'goodbye',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });

        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'goodbye', from, config.goodbyeMessage === true);
            return conn.sendMessage(from, {
                text: fancy(`👋 Goodbye in this group: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}goodbye on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'goodbye', from, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Goodbye ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — fired by handler.handleGroupUpdate()
    // ============================================================
    async onGroupLeave(conn, groupJid, members) {
        if (!members?.length) return;

        let groupName = 'this group';
        try {
            const meta = await conn.groupMetadata(groupJid);
            groupName = meta.subject || groupName;
        } catch {}

        const text = buildGoodbyeText(groupName, members);

        try {
            await conn.sendMessage(groupJid, {
                text,
                mentions: members
            });
            console.log(`[goodbye] farewelled ${members.length} member(s) from ${groupJid}`);
        } catch (e) {
            console.error('[goodbye] send failed:', e.message);
        }
    }
};