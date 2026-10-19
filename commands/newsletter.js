// commands/newsletter.js
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'newsletter',
    category: 'admin',
    aliases: ['nl', 'getjid'],
    description: 'Get JID of chat, user, or newsletter link',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, isGroup, sender } = ctx;

        // Only owner can use this
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const input = args[0];

        // =========================================================
        // 1. IF LINK PROVIDED (Newsletter JID)
        // =========================================================
        if (input && input.includes('whatsapp.com/channel/')) {
            const code = input.split('whatsapp.com/channel/')[1].split('?')[0];
            const wait = await conn.sendMessage(from, { text: fancy('🔎 Fetching Newsletter JID...') }, { quoted: msg });

            try {
                const meta = await conn.newsletterMetadata('invite', code);
                await conn.sendMessage(from, {
                    text: fancy(`🆔 \`${meta.id}\``),
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
        // 2. IF IN GROUP (Group JID)
        // =========================================================
        if (isGroup) {
            return conn.sendMessage(from, { 
                text: fancy(`👥 *Group JID:*\n\`${from}\``) 
            }, { quoted: msg });
        }

        // =========================================================
        // 3. IF IN DM (User's JID)
        // =========================================================
        return conn.sendMessage(from, { 
            text: fancy(`👤 *User JID:*\n\`${sender}\``) 
        }, { quoted: msg });
    }
};