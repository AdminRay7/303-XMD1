// commands/newsletter.js
// Manage WhatsApp Newsletters (Channels).
// Usage:
//   .newsletter create <name> | <description>
//   .newsletter lookup <channel_link_or_code>
//   .newsletter list

const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'newsletter',
    category: 'admin',
    aliases: ['channel', 'nl'],
    description: 'Create, lookup, or list WhatsApp Channels',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;

        // Only the owner should be creating or looking up channels
        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        }

        const action = (args[0] || '').toLowerCase();

        // ==========================================
        // 1. CREATE
        // ==========================================
        if (action === 'create') {
            const input = args.slice(1).join(' ');
            if (!input) {
                return conn.sendMessage(from, { 
                    text: fancy(`Usage: ${config.prefix}newsletter create <name> | <description>`) 
                }, { quoted: msg });
            }

            // Split by the pipe symbol "|" to separate name and description
            const parts = input.split('|');
            const name = parts[0].trim();
            const description = parts[1] ? parts[1].trim() : '';

            if (!name) {
                return conn.sendMessage(from, { text: fancy('❌ Channel name is required.') });
            }

            const wait = await conn.sendMessage(from, { text: fancy('📢 Creating channel...') }, { quoted: msg });

            try {
                const newChannel = await conn.newsletterCreate(name, description);
                
                await conn.sendMessage(from, {
                    text: fancy(
                        `✅ *Channel Created!*\n\n` +
                        `📛 Name: ${newChannel.name}\n` +
                        `🆔 JID: \`${newChannel.id}\`\n\n` +
                        `_Save this JID in your .env as NEWSLETTER_JID_`
                    ),
                    edit: wait.key
                });
            } catch (e) {
                console.error('[newsletter] create error:', e.message);
                await conn.sendMessage(from, { 
                    text: fancy(`❌ Failed to create channel: ${e.message}`), 
                    edit: wait.key 
                });
            }
            return;
        }

        // ==========================================
        // 2. LOOKUP
        // ==========================================
        if (action === 'lookup') {
            let code = args[1];
            if (!code) {
                return conn.sendMessage(from, { 
                    text: fancy(`Usage: ${config.prefix}newsletter lookup <link_or_code>`) 
                }, { quoted: msg });
            }

            // If the user pasted a full link, extract just the code
            if (code.includes('whatsapp.com/channel/')) {
                code = code.split('whatsapp.com/channel/')[1];
            }

            const wait = await conn.sendMessage(from, { text: fancy('🔎 Looking up channel...') }, { quoted: msg });

            try {
                const meta = await conn.newsletterMetadata('invite', code);
                
                await conn.sendMessage(from, {
                    text: fancy(
                        `✅ *Channel Found!*\n\n` +
                        `📛 Name: ${meta.name}\n` +
                        `🆔 JID: \`${meta.id}\`\n` +
                        `👥 Subscribers: ${meta.subscribers || 'Unknown'}`
                    ),
                    edit: wait.key
                });
            } catch (e) {
                console.error('[newsletter] lookup error:', e.message);
                await conn.sendMessage(from, { 
                    text: fancy(`❌ Failed to find channel. Invalid link or code.`), 
                    edit: wait.key 
                });
            }
            return;
        }

        // ==========================================
        // 3. LIST
        // ==========================================
        if (action === 'list') {
            const wait = await conn.sendMessage(from, { text: fancy('📋 Fetching followed channels...') }, { quoted: msg });

            try {
                // Fetch all channels the bot is subscribed to
                const channels = await conn.newsletterFetchAllParticipating();
                const jids = Object.keys(channels);

                if (!jids.length) {
                    return conn.sendMessage(from, { text: fancy('❌ Bot is not following any channels.'), edit: wait.key });
                }

                let text = `📋 *FOLLOWED CHANNELS*\n\n`;
                jids.forEach((jid, i) => {
                    const ch = channels[jid];
                    text += `${i + 1}. *${ch.name}*\n`;
                    text += `   🆔 \`${jid}\`\n\n`;
                });

                await conn.sendMessage(from, { text: fancy(text), edit: wait.key });
            } catch (e) {
                console.error('[newsletter] list error:', e.message);
                await conn.sendMessage(from, { 
                    text: fancy(`❌ Failed to fetch channels: ${e.message}`), 
                    edit: wait.key 
                });
            }
            return;
        }

        // ==========================================
        // USAGE
        // ==========================================
        return conn.sendMessage(from, { 
            text: fancy(
                `📢 *Newsletter Commands*\n\n` +
                `${config.prefix}newsletter create Name | Description\n` +
                `${config.prefix}newsletter lookup <link>\n` +
                `${config.prefix}newsletter list`
            ) 
        }, { quoted: msg });
    }
};