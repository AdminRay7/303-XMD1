const { fancy } = require('../lib/font');
module.exports = {
    name: 'calc',
    category: 'tools',
    aliases: ['math', 'evalmath'],
    description: 'Evaluate a math expression',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const expr = args.join(' ').trim();
        if (!expr) return conn.sendMessage(from, { text: fancy('❌ Usage: .calc 2 + 2 * 3') }, { quoted: msg });

        // Only allow numbers, operators, parens, dots, spaces
        if (!/^[\d+\-*/(). %^]+$/.test(expr)) {
            return conn.sendMessage(from, { text: fancy('❌ Invalid characters.') }, { quoted: msg });
        }
        try {
            // Safe eval via Function (expr is validated above)
            const safe = expr.replace(/\^/g, '**');
            const result = Function('"use strict"; return (' + safe + ')')();
            if (typeof result !== 'number' || !isFinite(result)) throw new Error('Bad result');
            await conn.sendMessage(from, {
                text: `╭─〔 🧮 ᴄᴀʟᴄ 〕\n│\n│ 📝 ${expr}\n│ ✅ ${result}\n│\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy('❌ Could not evaluate.') }, { quoted: msg });
        }
    }
};
