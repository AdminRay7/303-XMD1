// commands/kick.js
// Kick members from a group.
// Usage:
//   .kick 254712345678           → kick by phone
//   .kick @user                  → kick mentioned user
//   (reply) .kick                → kick the replied message's author
//   .kick 254xxx spam            → kick with reason
//   .kickban 254xxx              → kick + add to permanent ban list
//   .unban 254xxx                → remove from ban list
//   .banlist                     → show banned numbers
//
// Rules:
//   - Only the owner OR a group admin can use
//   - Bot must be group admin
//   - Cannot kick the bot itself, other admins, or the owner

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');
const mongoose = require('mongoose');

// ---- Ban list model ----
let KickBan;
try {
    KickBan = mongoose.models.KickBan;
} catch {}
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

async function getAllAdmins(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        return meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => bareNum(p.id));
    } catch { return []; }
}

// Parse target(s) from args / mentions / quoted
async function resolveTargets(conn, msg, args, ctx) {
    const targets = new Set();

    // 1. Mentioned users
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const j of mentioned) {
        const n = bareNum(j);
        if (n) targets.add(n);
    }

    // 2. Quoted user
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    if (quoted) {
        const n = bareNum(quoted);
        if (n) targets.add(n);
    }

    // 3. Phone numbers in args (10-15 digits)
    for (const a of (args || [])) {
        const digits = String(a).replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) targets.add(digits);
    }

    return [...targets];
}

async function notifyOwner(conn, sessionId, action, details) {
    try {
        if (!config.ownerNumber) return;
        const ownerJid = config.ownerNumber.replace(/\D/g, '') + '@s.whatsapp.net';
        const text =
            `📋 *${action}*\n\n` +
            `Session: \`${sessionId}\`\n` +
            `Group: ${details.group}\n` +
            `By: ${details.by}\n` +
            `Targets: ${details.targets.join(', ')}\n` +
            (details.reason ? `Reason: ${details.reason}\n` : '') +
            `Time: ${new Date().toISOString()}`;
        await conn.sendMessage(ownerJid, { text: fancy(text) });
    } catch (e) {
        console.error('[kick] owner notify failed:', e.message);
    }
}

module.exports = {
    name: 'kick',
    category: 'admin',
    aliases: ['remove'],
    description: 'Kick members from a group (owner + admin only)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;

        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });

        // Authorization
        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) {
            return conn.sendMessage(from, { text: fancy('❌ Only the owner or a group admin can use this.') });
        }

        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to kick members.') });
        }

        // Special sub-commands
        const first = (args[0] || '').toLowerCase();

        // .kick → resolve targets
        const targets = await resolveTargets(conn, msg, args, ctx);
        if (!targets.length) {
            return conn.sendMessage(from, {
                text: fancy(
                    `Usage:\n` +
                    `${config.prefix}kick 254xxx\n` +
                    `${config.prefix}kick @user\n` +
                    `(reply) ${config.prefix}kick\n` +
                    `${config.prefix}kick 254xxx <reason>`
                )
            }, { quoted: msg });
        }

        // Reason = non-numeric args after the numbers
        const reasonArgs = (args || []).filter(a => {
            const d = String(a).replace(/\D/g, '');
            return !(d.length >= 10 && d.length <= 15);
        });
        const reason = reasonArgs.join(' ').trim() || '';

        // Get admin list + bot + owner to protect
        const admins = await getAllAdmins(conn, from);
        const botBare = bareNum(conn.user?.id);
        const ownerBare = String(config.ownerNumber || '').replace(/\D/g, '');

        const kicked = [];
        const skipped = [];

        for (const num of targets) {
            if (num === botBare)    { skipped.push(`${num} (bot)`); continue; }
            if (num === ownerBare)  { skipped.push(`${num} (owner)`); continue; }
            if (admins.includes(num)) { skipped.push(`${num} (admin)`); continue; }

            const jid = num + '@s.whatsapp.net';
            try {
                await conn.groupParticipantsUpdate(from, [jid], 'remove');
                kicked.push(num);
            } catch (e) {
                skipped.push(`${num} (${e.message})`);
            }
        }

        // Report
        const groupName = (await conn.groupMetadata(from).catch(() => ({}))).subject || from;
        const report =
            `⚔️ *KICK REPORT*\n\n` +
            `✅ Kicked: ${kicked.length ? kicked.join(', ') : 'none'}\n` +
            (skipped.length ? `⛔ Skipped: ${skipped.join(', ')}\n` : '') +
            (reason ? `📝 Reason: ${reason}` : '');

        await conn.sendMessage(from, { text: fancy(report) }, { quoted: msg });

        // Notify owner
        if (kicked.length) {
            notifyOwner(conn, userId, 'KICK', {
                group: groupName,
                by: bareNum(sender),
                targets: kicked,
                reason
            }).catch(() => {});
        }

        return true;
    }
};