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

module.exports = {
    name: 'unban',
    category: 'admin',
    aliases: ['banlist'],
    description: 'Remove a number from the ban list, or show the whole list',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const nums = (args || []).map(a => String(a).replace(/\D/g, '')).filter(n => n.length >= 10);

        if (!nums.length) {
            const list = await KickBan.find({ sessionId: userId }).lean();
            if (!list.length) return conn.sendMessage(from, { text: fancy('✅ Ban list is empty.') }, { quoted: msg });
            const lines = list.map(b => `• ${b.number}${b.reason ? ` — ${b.reason}` : ''}`).join('\n');
            return conn.sendMessage(from, { text: fancy(`🚫 *Banned numbers:*\n\n${lines}`) }, { quoted: msg });
        }

        let removed = 0;
        for (const n of nums) {
            const res = await KickBan.deleteOne({ sessionId: userId, number: n });
            if (res.deletedCount) removed++;
        }

        return conn.sendMessage(from, {
            text: fancy(`✅ Unbanned: ${removed} number(s)`)
        }, { quoted: msg });
    }
};