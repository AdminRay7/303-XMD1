cd ~/storage/downloads/303-xmd-commands && cat > menu.js << 'EOF'
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'menu',
    category: 'general',
    aliases: ['help', 'h'],
    description: 'Show all available commands',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const prefix = config.prefix || '.';

        // Live-scan commands folder every time
        const cmdDir = path.join(__dirname);
        const grouped = {};

        const walk = (dir) => {
            for (const item of fs.readdirSync(dir)) {
                const full = path.join(dir, item);
                const stat = fs.statSync(full);
                if (stat.isDirectory()) { walk(full); continue; }
                if (!item.endsWith('.js')) continue;
                if (item === 'menu.js') continue;
                try {
                    delete require.cache[require.resolve(full)];
                    const mod = require(full);
                    if (!mod || typeof mod.execute !== 'function') continue;
                    const cat = (mod.category || 'general').toLowerCase();
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push({
                        name: mod.name || item.replace('.js', ''),
                        desc: mod.description || ''
                    });
                } catch (e) { /* skip broken files */ }
            }
        };
        try { walk(cmdDir); } catch (e) { console.error('menu walk:', e.message); }

        // Category order + emoji
        const CAT_META = {
            general:  { emoji: '📌', title: 'GENERAL' },
            admin:    { emoji: '🛡️', title: 'ADMIN' },
            group:    { emoji: '👥', title: 'GROUP' },
            fun:      { emoji: '🎮', title: 'FUN' },
            tools:    { emoji: '🔧', title: 'TOOLS' },
            text:     { emoji: '✍️', title: 'TEXT' },
            media:    { emoji: '🖼️', title: 'MEDIA' },
            misc:     { emoji: '📎', title: 'MISC' },
            ai:       { emoji: '🤖', title: 'AI' },
            download: { emoji: '⬇️', title: 'DOWNLOAD' },
            auto:     { emoji: '⚙️', title: 'AUTO TOGGLES' }
        };

        const order = ['general','admin','group','fun','tools','text','media','misc','ai','download','auto'];
        for (const k of Object.keys(grouped)) if (!order.includes(k)) order.push(k);

        let text = `╭─〔 🔑 ${fancy(config.botName || '303-XMD')} 〕\n│\n`;
        text += `│ 👤 ᴜsᴇʀ   : ${ctx.pushname || 'User'}\n`;
        text += `│ 🎯 ᴘʀᴇғɪx : ${prefix}\n`;
        text += `│ 📦 ᴄᴍᴅs   : ${Object.values(grouped).reduce((a,b)=>a+b.length,0)}\n`;
        text += `│\n╰──────────────────────\n\n`;

        for (const cat of order) {
            const items = grouped[cat];
            if (!items || !items.length) continue;
            const meta = CAT_META[cat] || { emoji: '📁', title: cat.toUpperCase() };
            items.sort((a,b) => a.name.localeCompare(b.name));
            text += `╭─〔 ${meta.emoji} ${fancy(meta.title)} 〕\n│\n`;
            for (const c of items) {
                text += `│ ◇ ${prefix}${c.name}\n`;
            }
            text += `│\n╰──────────────────────\n\n`;
        }

        text += `_${fancy(config.footer || '303-XMD — THE LAST KEY')}_`;

        // Send with image if Assets/menu.png exists
        const imgPath = path.join(__dirname, '..', 'Assets', 'menu.png');
        try {
            if (fs.existsSync(imgPath)) {
                const buffer = fs.readFileSync(imgPath);
                await conn.sendMessage(from, { image: buffer, caption: text }, { quoted: msg });
            } else {
                await conn.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (e) {
            await conn.sendMessage(from, { text }, { quoted: msg });
        }
    }
};
EOF
echo "✅ menu.js created in ~/storage/downloads/303-xmd-commands/"