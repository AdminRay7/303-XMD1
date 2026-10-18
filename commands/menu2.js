// commands/menu2.js
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

// Helper to scan commands
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

// Map categories to emojis
const CATEGORY_EMOJIS = {
    general: '📌',
    admin: '🛡️',
    group: '👥',
    fun: '🎮',
    tools: '🔧',
    media: '🖼️',
    download: '⬇️',
    auto: '⚙️',
    owner: '👑',
    islamic: '⚡',
    ai: '🤖'
};

module.exports = {
    name: 'menu2',
    category: 'general',
    aliases: ['m2'],
    description: 'Interactive categorized menu',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const grouped = getCommands();
        
        // Sort categories based on this order, then put the rest at the end
        const order = ['general', 'admin', 'group', 'fun', 'tools', 'media', 'download', 'auto', 'owner', 'islamic', 'ai'];
        const activeCats = Object.keys(grouped).sort((a, b) => {
            let iA = order.indexOf(a), iB = order.indexOf(b);
            if (iA === -1) iA = 99;
            if (iB === -1) iB = 99;
            return iA - iB;
        });

        // ---- Image Paths ----
        const menuImg = path.join(__dirname, '..', 'Assets', 'menu.jpg');
        const hasMenuImg = fs.existsSync(menuImg);

        // ---- 1. Build Main Menu ----
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

        // Send with menu image as header
        const sent = hasMenuImg
            ? await conn.sendMessage(from, { image: fs.readFileSync(menuImg), caption: text }, { quoted: msg })
            : await conn.sendMessage(from, { text }, { quoted: msg });

        // ---- 2. Set up Listener ----
        const listener = async (update) => {
            const m = update.messages[0];
            if (!m.message) return;
            
            const body = m.message.conversation || m.message.extendedTextMessage?.text || '';
            const sender = m.key.participant || m.key.remoteJid;
            const ctxSender = ctx.sender;

            if (sender !== ctxSender || m.key.remoteJid !== from) return;

            const choice = parseInt(body.trim());
            
            if (isNaN(choice) || choice < 0 || choice > activeCats.length) return;

            conn.ev.off('messages.upsert', listener);

            let editText = '';

            if (choice === 0) {
                editText = text;
            } else {
                const selectedCat = activeCats[choice - 1];
                const items = grouped[selectedCat].sort();
                const emoji = CATEGORY_EMOJIS[selectedCat] || '📁';
                
                // Add the emoji to the category title
                editText = `╭─〔 ${emoji} *${selectedCat.toUpperCase()}* 〕\n│\n`;
                for (const cmd of items) {
                    editText += `│ ◇ ${config.prefix}${cmd}\n`;
                }
                editText += `│\n│ 0. ⬅️ BACK TO MENU\n│\n`;
                editText += `╰──────────────────────\n\n`;
                editText += `_Reply 0 to go back._`;
            }

            // Edit the original message
            try {
                await conn.sendMessage(from, { text: editText, edit: sent.key });
            } catch (e) {
                console.error('[menu2] edit failed:', e.message);
            }

            if (choice !== 0) {
                setupListener();
            }
        };

        const setupListener = () => {
            conn.ev.on('messages.upsert', async (update) => {
                const m = update.messages[0];
                if (!m.message) return;
                const body = m.message.conversation || m.message.extendedTextMessage?.text || '';
                const sender = m.key.participant || m.key.remoteJid;
                if (sender !== ctxSender || m.key.remoteJid !== from) return;

                if (body.trim() === '0') {
                    conn.ev.off('messages.upsert', setupListener); 
                    hasMenuImg
                        ? await conn.sendMessage(from, { image: fs.readFileSync(menuImg), caption: text }, { quoted: m })
                        : await conn.sendMessage(from, { text }, { quoted: m });
                }
            });
        };

        conn.ev.on('messages.upsert', listener);
    }
};