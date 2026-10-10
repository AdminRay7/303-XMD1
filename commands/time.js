const { fancy } = require('../lib/font');
module.exports = {
    name: 'time',
    category: 'tools',
    aliases: ['date', 'clock'],
    description: 'Show current date and time',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const now = new Date();
        const utc = now.toUTCString();
        const local = now.toString();
        const epoch = Math.floor(now.getTime() / 1000);
        await conn.sendMessage(from, {
            text:
                `╭─〔 🕐 ᴛɪᴍᴇ 〕\n│\n` +
                `│ 🌍 UTC:   ${utc}\n` +
                `│ 💻 Local: ${local}\n` +
                `│ ⏱ Epoch: ${epoch}\n│\n` +
                `╰──────────────────────`
        }, { quoted: msg });
    }
};
