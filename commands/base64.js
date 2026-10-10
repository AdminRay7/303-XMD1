const { fancy } = require('../lib/font');
module.exports = {
    name: 'base64',
    category: 'tools',
    aliases: ['b64'],
    description: 'Encode or decode Base64 (auto-detects)',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const input = args.join(' ').trim();
        if (!input) return conn.sendMessage(from, { text: fancy('❌ Usage: .base64 hello  OR  .base64 aGVsbG8=') }, { quoted: msg });

        const isB64 = /^[A-Za-z0-9+/]+={0,2}$/.test(input) && input.length % 4 === 0;
        let out, mode;
        try {
            if (isB64) {
                out = Buffer.from(input, 'base64').toString('utf-8');
                mode = 'Decoded';
            } else {
                out = Buffer.from(input, 'utf-8').toString('base64');
                mode = 'Encoded';
            }
            await conn.sendMessage(from, {
                text: `╭─〔 🔤 ʙᴀꜱᴇ64 〕\n│\n│ 🔄 ${mode}:\n│ ${out}\n│\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy('❌ Could not process.') }, { quoted: msg });
        }
    }
};
