// commands/menu2.js
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

function getCommands() {
    const grouped = {};
    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            if (fs.statSync(full).isDirectory()) { walk(full); continue; }
            if (!item.endsWith('.js') || item.startsWith('menu')) continue;
            try {
                delete require.cache[require.resolve(full)];
                const mod = require(full);
                if (!mod || typeof mod.execute !== 'function') continue;
                const cat = (mod.category || 'general').toLowerCase();
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(mod.name);
            } catch {}
        }
    };
    try { walk(path.join(__dirname)); } catch {}
    return grouped;
}

const CATEGORY_EMOJIS = {
    general: '📌', admin: '🛡️', group: '👥', fun: '🎮', tools: '🔧',
    media: '🖼️', download: '⬇️', auto: '⚙️', owner: '👑', islamic: '⚡', ai: '🤖'
};

module.exports = {
    name: 'menu2',
    category: 'general',
    aliases: ['m2'],
    description: 'Interactive categorized menu',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const grouped = getCommands();
        
        const order = ['general', 'admin', 'group', 'fun', 'tools', 'media', 'download', 'auto', 'owner', 'islamic', 'ai'];
        const activeCats = Object.keys(grouped).sort((a, b) => {
            let iA = order.indexOf(a), iB = order.indexOf(b);
            if (iA === -1) iA = 99;
            if (iB === -1) iB = 99;
            return iA - iB;
        });

        const menuImg = path.join(__dirname, '..', 'Assets', 'menu.jpg');
        const hasMenuImg = fs.existsSync(menuImg);

        // Build main menu text
        let text = `╭─〔 🔑 *303-XMD MENU* 〕\n│\n`;
        text += `│ 👤 OWNER : ${config.ownerName || 'Mr Presenter'}\n`;
        text += `│ ⚡ PREFIX : [ ${config.prefix || '.'} ]\n`;
        text += `│\n│ *Please reply with a number:*\n│\n`;

        activeCats.forEach((cat, index) => {
            const count = grouped[cat].length;
            const emoji = CATEGORY_EMOJIS[cat] || '📁';
            text += `│ ${index + 1}. ${emoji} ${cat.toUpperCase()} (${count})\n`;
        });

        text += `│\n╰──────────────────────\n\n`;
        text += `_Reply with the number (e.g., 1) to view commands._`;

        // 1. Send main menu (with image)
        const sent = hasMenuImg
            ? await conn.sendMessage(from, { image: fs.readFileSync(menuImg), caption: text }, { quoted: msg })
            : await conn.sendMessage(from, { text }, { quoted: msg });

        // 2. Listen for reply
        const listener = async (update) => {
            const m = update.messages[0];
            if (!m.message) return;
            
            const body = m.message.conversation || m.message.extendedTextMessage?.text || '';
            const sender = m.key.participant || m.key.remoteJid;
            
            // Only listen to the person who ran the command
            if (sender !== ctx.sender || m.key.remoteJid !== from) return;

            const choice = parseInt(body.trim());
            if (isNaN(choice) || choice < 0 || choice > activeCats.length) return;

            // Stop listening
            conn.ev.off('messages.upsert', listener);

            if (choice === 0) {
                // Resend main menu
                hasMenuImg
                    ? await conn.sendMessage(from, { image: fs.readFileSync(menuImg), caption: text }, { quoted: m })
                    : await conn.sendMessage(from, { text }, { quoted: m });
                
                // Re-attach listener
                conn.ev.on('messages.upsert', listener);
            } else {
                const selectedCat = activeCats[choice - 1];
                const items = grouped[selectedCat].sort();
                const emoji = CATEGORY_EMOJIS[selectedCat] || '📁';
                
                let editText = `╭─〔 ${emoji} *${selectedCat.toUpperCase()}* 〕\n│\n`;
                for (const cmd of items) {
                    editText += `│ ◇ ${config.prefix}${cmd}\n`;
                }
                editText += `│\n│ 0. ⬅️ BACK TO MENU\n│\n`;
                editText += `╰──────────────────────\n\n`;
                editText += `_Reply 0 to go back._`;

                // SEND AS NEW MESSAGE (instead of editing)
                await conn.sendMessage(from, { text: editText }, { quoted: m });

                // Listen for "0" to go back
                const backListener = async (upd) => {
                    const m2 = upd.messages[0];
                    if (!m2.message) return;
                    const b2 = m2.message.conversation || m2.message.extendedTextMessage?.text || '';
                    const s2 = m2.key.participant || m2.key.remoteJid;
                    if (s2 !== ctx.sender || m2.key.remoteJid !== from) return;

                    if (b2.trim() === '0') {
                        conn.ev.off('messages.upsert', backListener);
                        hasMenuImg
                            ? await conn.sendMessage(from, { image: fs.readFileSync(menuImg), caption: text }, { quoted: m2 })
                            : await conn.sendMessage(from, { text }, { quoted: m2 });
                        // Re-attach main listener
                        conn.ev.on('messages.upsert', listener);
                    }
                };
                conn.ev.on('messages.upsert', backListener);
            }
        };

        conn.ev.on('messages.upsert', listener);
    }
};