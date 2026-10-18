// commands/promote.js
// Make members group admins.
// Usage: .promote @user OR reply with .promote
const { fancy } = require('../lib/font');
const config = require('../config');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
async function isBotAdmin(conn, jid) {
    const meta = await conn.groupMetadata(jid);
    const b = bareNum(conn.user?.id), bl = bareNum(conn.user?.lid);
    const me = meta.participants.find(p => bareNum(p.id) === b || (bl && bareNum(p.id) === bl));
    return me && (me.admin === 'admin' || me.admin === 'superadmin');
}
async function isAdmin(conn, jid, sender) {
    const meta = await conn.groupMetadata(jid);
    return meta.participants.some(p => bareNum(p.id) === bareNum(sender) && (p.admin === 'admin' || p.admin === 'superadmin'));
}

module.exports = {
    name: 'promote',
    category: 'admin',
    aliases: ['admin'],
    description: 'Promote member to admin',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;
        if (!isGroup) return;
        if (!isOwner && !(await isAdmin(conn, from, sender))) return;
        if (!(await isBotAdmin(conn, from))) return;

        const targets = new Set();
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        mentions.forEach(j => targets.add(bareNum(j)));
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) targets.add(bareNum(quoted));

        if (!targets.size) return conn.sendMessage(from, { text: fancy('❌ Tag or reply to a user.') }, { quoted: msg });

        const meta = await conn.groupMetadata(from);
        const jids = [...targets].map(n => meta.participants.find(p => bareNum(p.id) === n)?.id).filter(Boolean);

        if (!jids.length) return;

        try {
            await conn.groupParticipantsUpdate(from, jids, 'promote');
            await conn.sendMessage(from, { react: { text: '👑', key: msg.key } });
        } catch (e) { console.error('[promote]', e.message); }
    }
};