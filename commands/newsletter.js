// commands/newsletter.js
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'newsletter',
    category: 'general',
    aliases: ['jid', 'getjid'],
    description: 'Get JID of chat, user, or newsletter link',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, sender } = ctx;
        const input = args[0];

        // =========================================================
        // 1. WITH LINK (Newsletter JID)
        // =========================================================
        if (input && input.includes('whatsapp.com/channel/')) {
            const code = input.split('whatsapp.com/channel/')[1].split('?')[0];
            const wait = await conn.sendMessage(from, { text: fancy('🔎 Fetching Newsletter JID...') }, { quoted: msg });

            try {
                const meta = await conn.newsletterMetadata('invite', code);
                await conn.sendMessage(from, {
                    text: `📢 Newsletter JID:\n${meta.id}`,
                    edit: wait.key
                });
            } catch (e) {
                console.error('[newsletter] error:', e.message);
                await conn.sendMessage(from, {
                    text: fancy('❌ Invalid link or channel not found.'),
                    edit: wait.key
                });
            }
            return;
        }

        // =========================================================
        // 2. IN A GROUP (Group JID)
        // =========================================================
        if (isGroup) {
            return conn.sendMessage(from, { 
                text: `👥 Group JID:\n${from}` 
            }, { quoted: msg });
        }

        // =========================================================
        // 3. IN A DM (User JID - Convert LID to Real Number)
        // =========================================================
        try {
            // Baileys has a built-in method to map @lid back to @s.whatsapp.net
            const pnJid = await conn.getJidFromLid(sender);
            const finalJid = pnJid || sender; // Fallback to sender if mapping fails
            
            return conn.sendMessage(from, { 
                text: `👤 User JID:\n${finalJid}` 
            }, { quoted: msg });
        } catch (e) {
            // Fallback if the mapping method fails
            return conn.sendMessage(from, { 
                text: `👤 User JID:\n${sender}` 
            }, { quoted: msg });
        }
    }
};