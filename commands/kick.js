// commands/kick.js
// Silent, instant kick. Uses real participant JIDs from metadata (LID-safe).

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

        // ============================================================
        //   KEY FIX: build a map of bareNum → REAL participant JID
        //   (handles @lid AND @s.whatsapp.net automatically)
        // ============================================================
        let participantMap = {};
        let admins = [];
        try {
            const meta = await conn.groupMetadata(from);
            for (const p of meta.participants) {
                const bare = bareNum(p.id);
                if (bare) participantMap[bare] = p.id;
                if (p.admin === 'admin' || p.admin === 'superadmin') admins.push(bare);
            }
        } catch (e) {
            console.error('[kick] metadata read failed:', e.message);
            return;
        }

        const botBare = bareNum(conn.user?.id);
        const ownerBare = String(config.ownerNumber || '').replace(/\D/g, '');

        const jidsToRemove = [];

        for (const num of targets) {
            if (num === botBare) continue;
            if (num === ownerBare) continue;
            if (admins.includes(num)) continue;

            const realJid = participantMap[num];
            if (!realJid) {
                console.log(`[kick] ${num} not found in group participants`);
                continue;
            }
            jidsToRemove.push(realJid);
        }

        if (!jidsToRemove.length) return;

        try {
            await conn.groupParticipantsUpdate(from, jidsToRemove, 'remove');
            // Silent acknowledgement
            try {
                await conn.sendMessage(from, { react: { text: '⚔️', key: msg.key } });
            } catch {}
        } catch (e) {
            console.error('[kick] groupParticipantsUpdate failed:', e.message);
        }
    }
};