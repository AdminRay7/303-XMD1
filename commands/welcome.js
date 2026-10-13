// commands/welcome.js
// Greets new members when they join a group.
// Toggle: .welcome on | off | (no args = show state)
// Scope: per-group (each group has its own on/off)

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

function buildWelcomeText(groupName, members) {
    const mentions = members.map(m => `@${bareNum(m)}`).join(' ');
    const count = members.length;

    const line = count > 1
        ? `👋 Welcome to *${groupName}*!`
        : `👋 Welcome to *${groupName}*!`;

    return (
        `╭─〔 🎉 ᴡᴇʟᴄᴏᴍᴇ 〕\n│\n` +
        `│ ${line}\n` +
        `│ ${mentions}\n` +
        `│\n` +
        `│ Thanks for joining — enjoy your stay!\n` +
        `│\n` +
        `╰──────────────────────\n\n` +
        `_${config.footer || '303-XMD — THE LAST KEY'}_`
    );
}

module.exports = {
    name: 'welcome',
    category: 'auto',
    aliases: ['wc'],
    description: 'Welcome new group members',
    toggleKey: 'welcome',
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
            const on = await autoToggles.get(userId, 'welcome', from, config.welcomeMessage === true);
            return conn.sendMessage(from, {
                text: fancy(`🎉 Welcome in this group: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}welcome on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'welcome', from, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Welcome ${value ? 'ENABLED' : 'DISABLED'} for this group.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — fired by handler.handleGroupUpdate()
    // ============================================================
    async onGroupJoin(conn, groupJid, members) {
        if (!members?.length) return;

        let groupName = 'this group';
        try {
            const meta = await conn.groupMetadata(groupJid);
            groupName = meta.subject || groupName;
        } catch {}

        const text = buildWelcomeText(groupName, members);

        try {
            await conn.sendMessage(groupJid, {
                text,
                mentions: members
            });
            console.log(`[welcome] greeted ${members.length} member(s) in ${groupJid}`);
        } catch (e) {
            console.error('[welcome] send failed:', e.message);
        }
    }
};