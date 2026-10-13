// commands/add.js
// Add members silently — LID-aware via onWhatsApp resolution.

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
    try { return !!(await KickBan.findOne({ sessionId, number }).lean()); }
    catch { return false; }
}

module.exports = {
    name: 'add',
    category: 'admin',
    aliases: [],
    description: 'Add members to a group (LID-aware)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;
        if (!isGroup) return;

        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) return;

        if (!(await isBotGroupAdmin(conn, from))) {
            console.log('[add] bot not group admin');
            return;
        }

        // Collect candidates
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
        //   LID-AWARE RESOLUTION
        //   Try every known JID form until one succeeds.
        // ============================================================
        for (const num of candidates) {
            if (await isBanned(userId, num)) {
                console.log(`[add] ${num} is banned`);
                continue;
            }

            // Get all possible JID forms for this number
            const jidsToTry = [];

            // 1) Ask WhatsApp — returns the authoritative JID
            try {
                const check = await conn.onWhatsApp(num + '@s.whatsapp.net');
                if (check?.length) {
                    const info = check[0];
                    // Prefer lid form when available
                    if (info.lid) jidsToTry.push(info.lid);
                    if (info.jid) jidsToTry.push(info.jid);
                } else {
                    console.log(`[add] ${num} not on WhatsApp`);
                    continue;
                }
            } catch (e) {
                console.error(`[add] onWhatsApp failed for ${num}:`, e.message);
            }

            // 2) Fallback forms
            if (!jidsToTry.includes(num + '@s.whatsapp.net')) jidsToTry.push(num + '@s.whatsapp.net');
            if (!jidsToTry.includes(num + '@lid'))            jidsToTry.push(num + '@lid');

            // Try each until one works
            let added = false;
            for (const jid of jidsToTry) {
                try {
                    await conn.groupParticipantsUpdate(from, [jid], 'add');
                    console.log(`[add] ✅ added ${num} via ${jid}`);
                    added = true;
                    break;
                } catch (e) {
                    console.log(`[add] ❌ failed ${jid}: ${e.message}`);
                }
            }

            if (added) {
                try {
                    await conn.sendMessage(from, { react: { text: '➕', key: msg.key } });
                } catch {}
            }
        }
    }
};