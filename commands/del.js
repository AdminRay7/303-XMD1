// commands/del.js
// Deletes the message you replied to, AND the command itself.
// Usage: (reply to a message) .del
// Rules:
//   - Owner only
//   - Bot must be admin to delete others' messages
//   - Works in groups and DMs

const { fancy } = require('../lib/font');

module.exports = {
    name: 'del',
    category: 'admin',
    aliases: ['delete'],
    description: 'Delete the replied message (and the .del command)',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup, userId } = ctx;

        // Owner only
        if (!isOwner) return;

        // Get the replied message
        const quoted = msg.message?.extendedTextMessage?.contextInfo;
        if (!quoted || !quoted.stanzaId) {
            return conn.sendMessage(from, { 
                text: fancy(`❌ Reply to a message with ${require('../config').prefix}del to delete it.`) 
            }, { quoted: msg });
        }

        // 1. Delete the replied message
        try {
            const quotedKey = {
                remoteJid: from,
                fromMe: quoted.participant === conn.user?.id || quoted.participant === conn.user?.lid,
                id: quoted.stanzaId,
                participant: quoted.participant
            };

            await conn.sendMessage(from, { delete: quotedKey });
            console.log(`[del] deleted quoted message ${quoted.stanzaId}`);
        } catch (e) {
            console.error('[del] failed to delete quoted:', e.message);
        }

        // 2. Delete the .del command message
        try {
            await conn.sendMessage(from, { delete: msg.key });
            console.log(`[del] deleted command message ${msg.key.id}`);
        } catch (e) {
            console.error('[del] failed to delete command:', e.message);
        }
    }
};