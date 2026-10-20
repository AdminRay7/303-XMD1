// commands/trash.js
// Instantly delete recent messages from a specific user in a chat.
// Usage: Reply to a user's message with .trash [amount]
// Default amount: 10 messages.

const { fancy } = require('../lib/font');
const config = require('../config');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }

async function isBotGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botBare = bareNum(conn.user?.id);
        const botLidBare = bareNum(conn.user?.lid);
        const me = meta.participants.find(p => {
            const pidBare = bareNum(p.id);
            return pidBare === botBare || (botLidBare && pidBare === botLidBare);
        });
        return me && (me.admin === 'admin' || me.admin === 'superadmin');
    } catch { return false; }
}

module.exports = {
    name: 'trash',
    category: 'admin',
    aliases: ['nuke', 'purge'],
    description: 'Delete recent messages from a replied user',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;

        // 1. Owner only
        if (!isOwner) return;

        // 2. Must be in a group
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ This command only works in groups.') });

        // 3. Bot must be admin
        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to delete messages.') });
        }

        // 4. Must reply to a message
        const msgContext = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = msgContext?.quotedMessage;
        if (!quoted) {
            return conn.sendMessage(from, { text: fancy(`❌ Reply to the user's message you want to trash.`) }, { quoted: msg });
        }

        const targetJid = msgContext.participant;
        
        // 5. Parse amount (default 10, max 30)
        const amount = Math.min(parseInt(args[0]) || 10, 30);

        const wait = await conn.sendMessage(from, { text: fancy(`🧹 Trashing last ${amount} messages from @${bareNum(targetJid)}...`), mentions: [targetJid] });

        try {
            // Fetch last 50 messages from the chat history
            const messages = await conn.loadMessages(from, 50);
            
            // Filter messages by the target user
            const toDelete = messages
                .filter(m => (m.key.participant || m.key.remoteJid) === targetJid)
                .slice(0, amount);

            let deletedCount = 0;

            // Delete them one by one
            for (const m of toDelete) {
                try {
                    await conn.sendMessage(from, { delete: m.key });
                    deletedCount++;
                    // Small delay to prevent WhatsApp rate-limit bans
                    await new Promise(r => setTimeout(r, 300));
                } catch (e) {
                    console.error('[trash] Failed to delete:', e.message);
                }
            }

            // Update the wait message
            await conn.sendMessage(from, { 
                text: fancy(`✅ Deleted ${deletedCount} messages from @${bareNum(targetJid)}.`),
                mentions: [targetJid],
                edit: wait.key
            });

        } catch (e) {
            console.error('[trash] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to load chat history: ${e.message}`), edit: wait.key });
        }
    }
};