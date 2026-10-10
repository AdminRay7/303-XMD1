const { fancy } = require('../lib/font');
module.exports = {
    name: 'qr',
    category: 'tools',
    aliases: ['qrcode'],
    description: 'Generate a QR code image for any text/URL',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .qr https://example.com') }, { quoted: msg });
        try {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
            await conn.sendMessage(from, {
                image: { url },
                caption: `╭─〔 📱 ǫʀ ᴄᴏᴅᴇ 〕\n│ ${text}\n╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
