const fs = require('fs');
const path = require('path');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'commands',
    category: 'misc',
    aliases: ['cmdlist', 'total'],
    description: 'Count total loaded commands by category',
    async execute(conn, msg, args, ctx) {
        const { from, config } = ctx;
        const dir = path.join(__dirname, '..', 'commands');
        const seen = new Set();
        const byCat = {};
        let total = 0;

        const walk = (d) => {
            if (!fs.existsSync(d)) return;
            for (const item of fs.readdirSync(d)) {
                const fp = path.join(d, item);
                const st = fs.statSync(fp);
                if (st.isDirectory()) walk(fp);
                else if (item.endsWith('.js')) {
                    try {
                        delete require.cache[require.resolve(fp)];
                        const mod = require(fp);
                        if (!mod || seen.has(mod)) continue;
                        seen.add(mod);
                        const cat = (mod.category || 'general').toLowerCase();
                        byCat[cat] = (byCat[cat] || 0) + 1;
                        total++;
                    } catch {}
                }
            }
        };
        walk(dir);

        const sorted = Object.keys(byCat).sort();
        let text = `╭─〔 📊 ᴄᴏᴍᴍᴀɴᴅ ᴄᴏᴜɴᴛ 〕\n│\n│ 📦 Total: ${total}\n│\n`;
        for (const cat of sorted) {
            text += `│ ${cat.padEnd(12)} ${byCat[cat]}\n`;
        }
        text += `│\n╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
