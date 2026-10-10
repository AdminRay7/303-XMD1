const { fancy } = require('../lib/font');
module.exports = {
    name: 'hex',
    category: 'tools',
    aliases: ['tohex'],
    description: 'Convert text to hex or back (auto-detects)',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const input = args.join(' ').trim();
        if (!input) return conn.sendMessage(from, { text: fancy('❌ Usage: .hex hello  OR  .hex 68656c6c6f') }, { quoted: msg });

        try {
            let out, mode;
            if (/^[0-9a-fA-F\s]+$/.test(input) && input.replace(/\s+/g, '').length % 2 === 0) {
                out = Buffer.from(input.replace(/\s+/g, ''), 'hex').toString('utf-8');
                mode = 'Hex → Text';
            } else {
                out = Buffer.from(input, 'utf-8').toString('hex');
                mode = 'Text → Hex';
            }
            await conn.sendMessage(from, {
                text: `╭─〔 🔠 ʜᴇx 〕\n│\n│ 🔄 ${mode}\n│ ${out}\n│\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
