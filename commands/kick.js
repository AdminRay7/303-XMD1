// commands/kick.js
// Silent, instant kick. No reports, no "skipped" lines, no confirmation.
// Usage:
//   .kick 254xxx              → kick by phone
//   .kick @user               → kick mentioned user
//   (reply) .kick             → kick replied message's author
//   .kick 254xxx 254yyy       → kick multiple
//
// Rules:
//   - Owner OR group admin only
//   - Bot must be group admin
//   - Cannot kick bot / owner / other admins
//   - Silent success: only reacts ⚔️ to acknowledge
//   - Silent failure: logs to console only

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

async function isGroupAdmin(conn, groupJid, senderJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const senderBare = bareNum(senderJid);
        return meta.participants.some(p =>
            bareNum(p.id) === senderBare &&
            (p.admin === 'admin' || p.admin === 'superadmin')
        );
    } catch { return false; }
}

async function getAllAdmins(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        return meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => bareNum(p.id));
    } catch { return []; }
}

function resolveTargets(msg, args) {
    const targets = new Set();

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const j of mentioned) {
        const n = bareNum(j);
        if (n) targets.add(n);
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quoted) {
        const n = bareNum(quoted);
        if (n) targets.add(n);
    }

    for (const a of (args || [])) {
        const digits = String(a).replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) targets.add(digits);
    }

    return [...targets];
}

module.exports = {
    name: 'kick',
    category: 'admin',
    aliases: ['remove', 'k'],
    description: 'Kick members silently (owner + admin only)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;

        if (!isGroup) return;

        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) return;

        if (!(await isBotGroupAdmin(conn, from))) return;

        const targets = resolveTargets(msg, args);
        if (!targets.length) return;

        const admins = await getAllAdmins(conn, from);
        const botBare = bareNum(conn.user?.id);
        const ownerBare = String(config.ownerNumber || '').replace(/\D/g, '');

        let anyKicked = false;

        for (const num of targets) {
            if (num === botBare) continue;
            if (num === ownerBare) continue;
            if (admins.includes(num)) continue;

            const jid = num + '@s.whatsapp.net';
            try {
                await conn.groupParticipantsUpdate(from, [jid], 'remove');
                anyKicked = true;
            } catch (e) {
                // silent — log only
                console.error(`[kick] ${num}: ${e.message}`);
            }
        }

        // Silent acknowledgement — react to the command message
        if (anyKicked) {
            try {
                await conn.sendMessage(from, {
                    react: { text: '⚔️', key: msg.key }
                });
            } catch {}
        }
    }
};