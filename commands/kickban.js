const kick = require('./kick');
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

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

module.exports = {
    name: 'kickban',
    category: 'admin',
    aliases: ['kb'],
    description: 'Kick + permanently ban a number from being re-added',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only.') });
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        // Parse target
        const nums = [];
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const j of mentioned) nums.push(bareNum(j));
        for (const a of (args || [])) {
            const d = String(a).replace(/\D/g, '');
            if (d.length >= 10 && d.length <= 15) nums.push(d);
        }
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) nums.push(bareNum(quoted));

        if (!nums.length) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}kickban 254xxx`) }, { quoted: msg });
        }

        const reason = (args || []).filter(a => {
            const d = String(a).replace(/\D/g, '');
            return !(d.length >= 10 && d.length <= 15);
        }).join(' ').trim();

        for (const num of nums) {
            // Kick
            try {
                await conn.groupParticipantsUpdate(from, [num + '@s.whatsapp.net'], 'remove');
            } catch (e) {
                console.error('[kickban] kick failed:', e.message);
            }
            // Ban
            try {
                await KickBan.updateOne(
                    { sessionId: userId, number: num },
                    { $set: { reason, bannedBy: bareNum(sender), bannedAt: new Date() } },
                    { upsert: true }
                );
            } catch (e) {
                console.error('[kickban] ban failed:', e.message);
            }
        }

        return conn.sendMessage(from, {
            text: fancy(`🚫 Kicked + banned: ${nums.join(', ')}${reason ? `\n📝 ${reason}` : ''}`)
        }, { quoted: msg });
    }
};