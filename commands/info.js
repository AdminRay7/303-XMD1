// commands/info.js
// Get detailed info about a user or a group.
// Usage:
//   .info               (info about the group if in group, or about you if in DM)
//   .info @user         (info about a tagged user)
//   .info 2547xxxx     (info about a phone number)

const { fancy } = require('../lib/font');
const config = require('../config');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

module.exports = {
    name: 'info',
    category: 'general',
    aliases: ['whois', 'profile'],
    description: 'Get user or group information',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, pushname } = ctx;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targetJid = mentioned[0] || (args[0] ? args[0].replace(/\D/g, '') + '@s.whatsapp.net' : null);

        // --- USER INFO ---
        if (targetJid) {
            const num = bareNum(targetJid);
            let ppUrl = null;
            try { ppUrl = await conn.profilePictureUrl(targetJid, 'image'); } catch {}
            let status = null;
            try { const s = await conn.fetchStatus(targetJid); status = s?.status; } catch {}
            
            let text = `👤 *USER INFO*\n\n`;
            text += `📛 Number: +${num}\n`;
            if (status) text += `💬 About: ${status}\n`;
            
            if (ppUrl) {
                return conn.sendMessage(from, { image: { url: ppUrl }, caption: fancy(text) }, { quoted: msg });
            } else {
                return conn.sendMessage(from, { text: fancy(text + "\n(No profile picture)") }, { quoted: msg });
            }
        }

        // --- GROUP INFO ---
        if (isGroup) {
            const meta = await conn.groupMetadata(from);
            let ppUrl = null;
            try { ppUrl = await conn.profilePictureUrl(from, 'image'); } catch {}

            const admins = meta.participants.filter(p => p.admin).length;
            const text = `👥 *GROUP INFO*\n\n` +
                         `📛 Name: ${meta.subject}\n` +
                         `🆔 JID: ${from}\n` +
                         `👥 Members: ${meta.participants.length}\n` +
                         `🛡️ Admins: ${admins}\n` +
                         `📝 Desc: ${meta.desc || 'None'}\n` +
                         `🔒 Locked: ${meta.announce ? 'Yes' : 'No'}\n` +
                         `✏️ Edit Restricted: ${meta.restrict ? 'Yes' : 'No'}`;

            if (ppUrl) {
                return conn.sendMessage(from, { image: { url: ppUrl }, caption: fancy(text) }, { quoted: msg });
            } else {
                return conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
            }
        }

        // --- DM FALLBACK ---
        return conn.sendMessage(from, { text: fancy(`👤 Your Info\nNumber: +${bareNum(sender)}\nName: ${pushname}`) }, { quoted: msg });
    }
};