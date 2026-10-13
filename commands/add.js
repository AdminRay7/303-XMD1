// commands/add.js
// Add members silently. Uses onWhatsApp to get the REAL JID (LID-safe).

const { fancy } = require('../lib/font');
const config = require('../config');
const mongoose = require('mongoose');

let KickBan;
try { KickBan = mongoose.models.KickBan; } catch {}
if (!KickBan) {
    const schema = new mongoose.Schema({
        sessionId: { type: String, index: true },
        number:    { type: String, index: true },
        reason:    String,
        bannedBy:  String,
        bannedAt:  { type: Date, default: Date.now }
    });
    schema.index({ sessionId: 1, number: 1 }, { unique: true });
    KickBan = mongoose.models.KickBan || mongoose.model('KickBan', schema);
}

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

async function isBanned(sessionId, number) {
    try {
        return !!(await KickBan.findOne({ sessionId, number }).lean());
    } catch { return false; }
}

module.exports = {
    name: 'add',
    category: 'admin',
    aliases: [],
    description: 'Add members to a group (owner + admin only)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;
        if (!isGroup) return;

        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) return;

        if (!(await isBotGroupAdmin(conn, from))) return;

        // Collect candidate numbers
        const candidates = new Set();
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const j of mentioned) {
            const n = bareNum(j);
            if (n) candidates.add(n);
        }
        for (const a of (args || [])) {
            const d = String(a).replace(/\D/g, '');
            if (d.length >= 10 && d.length <= 15) candidates.add(d);
        }

        if (!candidates.size) return;

        // ============================================================
        //   KEY FIX: use onWhatsApp() to resolve the CORRECT JID
        //   (returns @lid JID when contact is LID-migrated)
        // ============================================================
        const jidsToAdd = [];

        for (const num of candidates) {
            if (await isBanned(userId, num)) {
                console.log(`[add] ${num} is banned, skipping`);
                continue;
            }

            const pnJid = num + '@s.whatsapp.net';

            try {
                // onWhatsApp returns the REAL JID WhatsApp expects
                const check = await conn.onWhatsApp(pnJid);
                if (!check || !check.length) {
                    console.log(`[add] ${num} not on WhatsApp`);
                    continue;
                }
                const realJid = check[0].jid || check[0].lid || pnJid;
                jidsToAdd.push(realJid);
            } catch (e) {
                console.error(`[add] onWhatsApp failed for ${num}:`, e.message);
            }
        }

        if (!jidsToAdd.length) return;

        try {
            await conn.groupParticipantsUpdate(from, jidsToAdd, 'add');
            try {
                await conn.sendMessage(from, { react: { text: '➕', key: msg.key } });
            } catch {}
        } catch (e) {
            console.error('[add] groupParticipantsUpdate failed:', e.message);
        }
    }
};