const config = require('../config');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'owner',
    category: 'misc',
    aliases: ['contact', 'dev', 'creator'],
    description: 'Show the bot owner contact with channel button',

    async execute(conn, msg, args, ctx) {
        const { from } = ctx;

        const phone = String(config.ownerNumber).replace(/\D/g, "");
        const name  = config.ownerName || "Owner";
        const channelLink = config.channelLink || "";
        const newsletterJid = config.newsletterJid || "";

        // ---------- Contact card (vCard) ----------
        const vcard =
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${name}\n` +
            `ORG:${config.botName || '303-XMD'}\n` +
            `TEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\n` +
            `END:VCARD`;

        // ---------- Text body ----------
        const body =
            `╭─〔 👑 ᴏᴡɴᴇʀ 〕\n│\n` +
            `│ 📛 Name:  ${name}\n` +
            `│ 📱 Phone: +${phone}\n` +
            `│ 💬 Chat:  https://wa.me/${phone}\n` +
            `│ 🤖 Bot:   ${config.botName} v${config.version}\n│\n` +
            `╰──────────────────────\n\n` +
            `_Tap below to view our channel or contact the owner._`;

        // ---------- 1) Send contact card ----------
        try {
            await conn.sendMessage(from, {
                contacts: {
                    displayName: name,
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });
        } catch (e) {
            console.error('owner contact card:', e.message);
        }

        // ---------- 2) Send body with channel context tag ----------
        const payload = {
            text: body,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: newsletterJid,
                    newsletterName: config.botName || '303-XMD',
                    serverMessageId: -1
                }
            }
        };

        try {
            await conn.sendMessage(from, payload, { quoted: msg });
        } catch (e) {
            console.error('owner channel tag:', e.message);
            // Fallback: plain text
            await conn.sendMessage(from, { text: body }, { quoted: msg });
        }

        // ---------- 3) Send channel URL button (interactive) ----------
        if (channelLink) {
            try {
                await conn.sendMessage(from, {
                    text: `📢 *${config.botName} Channel*\n\nJoin for updates, features & announcements.`,
                    footer: fancy(config.footer),
                    interactiveButtons: [
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📢 View Channel',
                                url: channelLink,
                                merchant_url: channelLink
                            })
                        }
                    ]
                }, { quoted: msg });
            } catch (e) {
                console.error('owner url button:', e.message);
                // Fallback: plain link
                await conn.sendMessage(from, {
                    text: `📢 *Channel:*\n${channelLink}`
                }, { quoted: msg });
            }
        }
    }
};