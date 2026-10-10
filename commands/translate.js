const axios = require('axios');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'translate',
    category: 'tools',
    aliases: ['tr', 'tl'],
    description: 'Translate text to another language',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        if (args.length < 2) return conn.sendMessage(from, { text: fancy('❌ Usage: .translate <lang> <text>') }, { quoted: msg });
        const lang = args[0].toLowerCase();
        const text = args.slice(1).join(' ');
        try {
            const r = await axios.get('https://translate.googleapis.com/translate_a/single', {
                params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: text }, timeout: 8000
            });
            const out = Array.isArray(r.data?.[0]) ? r.data[0].map(x => x[0]).join('') : text;
            await conn.sendMessage(from, {
                text: `╭─〔 🌐 ᴛʀᴀɴꜱʟᴀᴛᴇ 〕\n│\n│ ${out}\n│\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) { await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg }); }
    }
};
