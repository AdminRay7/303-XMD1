// commands/add.js
// Add members to a group.
// Usage:
//   .add 254712345678              → add by phone
//   .add 254xxx 254yyy 254zzz      → add multiple
//   .add @user                     → (works if user is in another group the bot shares)
//   .addall 254xxx 254yyy ...      → bulk add up to 20
//
// Rules:
//   - Only the owner OR a group admin can use
//   - Bot must be group admin
//   - Refuses numbers on the ban list
//   - Checks number exists on WhatsApp before adding

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

async function notifyOwner(conn, action, details) {
    try {
        if (!config.ownerNumber) return;
        const ownerJid = config.ownerNumber.replace(/\D/g, '') + '@s.whatsapp.net';
        const text =
            `📋 *${action}*\n\n` +
            `Group: ${details.group}\n` +
            `By: ${details.by}\n` +
            `Added: ${details.added.join(', ') || 'none'}\n` +
            `Failed: ${details.failed.join(', ') || 'none'}`;
        await conn.sendMessage(ownerJid, { text: fancy(text) });
    } catch (e) {
        console.error('[add] owner notify failed:', e.message);
    }
}

module.exports = {
    name: 'add',
    category: 'admin',
    aliases: [],
    description: 'Add members to a group (owner + admin only)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;

        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });

        const senderIsGroupAdmin = await isGroupAdmin(conn, from, sender);
        if (!isOwner && !senderIsGroupAdmin) {
            return conn.sendMessage(from, { text: fancy('❌ Only the owner or a group admin can use this.') });
        }

        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to add members.') });
        }

        // Collect candidates from args + mentions
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
                text: fancy(
                    `Usage:\n` +
                    `${config.prefix}add 254712345678\n` +
                    `${config.prefix}add 254xxx 254yyy\n` +
                    `${config.prefix}add @user`
                )
            }, { quoted: msg });
        }

        const added = [];
        const failed = [];
        const banned = [];

        for (const num of candidates) {
            // Ban list check
            if (await isBanned(userId, num)) {
                banned.push(num);
                continue;
            }

            const jid = num + '@s.whatsapp.net';

            // Check WhatsApp existence
            try {
                const check = await conn.onWhatsApp(jid);
                if (!check || !check.length || !check[0].exists) {
                    failed.push(`${num} (not on WhatsApp)`);
                    continue;
                }
            } catch (e) {
                failed.push(`${num} (check failed)`);
                continue;
            }

            // Add
            try {
                await conn.groupParticipantsUpdate(from, [jid], 'add');
                added.push(num);
            } catch (e) {
                failed.push(`${num} (${e.message})`);
            }
        }

        const groupName = (await conn.groupMetadata(from).catch(() => ({}))).subject || from;

        const report =
            `➕ *ADD REPORT*\n\n` +
            `✅ Added: ${added.length ? added.join(', ') : 'none'}\n` +
            (failed.length ? `⚠️ Failed: ${failed.join(', ')}\n` : '') +
            (banned.length ? `🚫 Banned: ${banned.join(', ')}` : '');

        await conn.sendMessage(from, { text: fancy(report) }, { quoted: msg });

        if (added.length) {
            notifyOwner(conn, 'ADD', {
                group: groupName,
                by: bareNum(sender),
                added,
                failed
            }).catch(() => {});
        }

        return true;
    }
};