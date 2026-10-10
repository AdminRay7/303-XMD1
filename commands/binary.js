const { fancy } = require('../lib/font');
module.exports = {
    name: 'binary',
    category: 'tools',
    aliases: ['bin', 'tobin'],
    description: 'Convert text to binary or back (auto-detects)',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const input = args.join(' ').trim();
        if (!input) return conn.sendMessage(from, { text: fancy('❌ Usage: .binary hello  OR  .binary 01101000...') }, { quoted: msg });

        try {
            let out, mode;
            if (/^[01\s]+$/.test(input)) {
                const clean = input.replace(/\s+/g, '');
                if (clean.length % 8 !== 0) throw new Error('Binary length must be multiple of 8');
                out = clean.match(/.{8}/g).map(b => String.fromCharCode(parseInt(b, 2))).join('');
                mode = 'Binary → Text';
            } else {
                out = input.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
                mode = 'Text → Binary';
            }
            await conn.sendMessage(from, {
                text: `╭─〔 🔢 ʙɪɴᴀʀʏ 〕\n│\n│ 🔄 ${mode}\n│ ${out}\n│\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
