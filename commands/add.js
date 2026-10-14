// commands/add.js
// Add members to a group — with clear feedback every time.

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
    description: 'Add members to a group (owner + admin only)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;

        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ Group only command.') }, { quoted: msg });
        }

        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) {
            return conn.sendMessage(from, { text: fancy('❌ Only the owner or a group admin can use this.') }, { quoted: msg });
        }

        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to add members.') }, { quoted: msg });
        }

        // ---- Collect candidates ----
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

        if (!candidates.size) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}add 2547XXXXXXXX`)
            }, { quoted: msg });
        }

        // ---- Get current group members (bare numbers) ----
        let currentMembers = new Set();
        try {
            const meta = await conn.groupMetadata(from);
            for (const p of meta.participants) {
                const n = bareNum(p.id);
                if (n) currentMembers.add(n);
            }
        } catch (e) {
            return conn.sendMessage(from, { text: fancy(`❌ Cannot read group info: ${e.message}`) }, { quoted: msg });
        }

        const added    = [];
        const already  = [];
        const notOnWA  = [];
        const bannedL  = [];
        const failed   = [];

        for (const num of candidates) {
            // Already in group?
            if (currentMembers.has(num)) {
                already.push(num);
                continue;
            }

            // Banned?
            if (await isBanned(userId, num)) {
                bannedL.push(num);
                continue;
            }

            const pnJid = num + '@s.whatsapp.net';

            // Not on WhatsApp?
            let exists = false;
            try {
                const check = await conn.onWhatsApp(pnJid);
                exists = !!(check && check.length && check[0].exists);
            } catch (e) {
                failed.push(`${num} (lookup failed)`);
                continue;
            }
            if (!exists) {
                notOnWA.push(num);
                continue;
            }

            // Try to add
            try {
                await conn.groupParticipantsUpdate(from, [pnJid], 'add');
                added.push(num);
            } catch (e) {
                failed.push(`${num} (${e.message})`);
            }
        }

        // ---- Build report ----
        const lines = [];
        lines.push(`➕ *ADD REPORT*`);
        lines.push('');
        if (added.length)     lines.push(`✅ Added: ${added.join(', ')}`);
        if (already.length)   lines.push(`👥 Already in group: ${already.join(', ')}`);
        if (notOnWA.length)   lines.push(`📵 Not on WhatsApp: ${notOnWA.join(', ')}`);
        if (bannedL.length)   lines.push(`🚫 Banned: ${bannedL.join(', ')}`);
        if (failed.length)    lines.push(`❌ Failed: ${failed.join(', ')}`);

        await conn.sendMessage(from, { text: fancy(lines.join('\n')) }, { quoted: msg });

        // React if anything succeeded
        if (added.length) {
            try {
                await conn.sendMessage(from, { react: { text: '➕', key: msg.key } });
            } catch {}
        }
    }
};