const { fancy } = require('../lib/font');
const axios = require('axios');
const { fetchYtMp3 } = require('../lib/downloadApi');

module.exports = {
    name: 'song',
    category: 'download',
    aliases: ['mp3dl', 'songdl', 'download'],
    description: 'Download a song as MP3 (also accepts YouTube URL)',

    async execute(conn, msg, args, ctx) {
        const { from, prefix } = ctx;
        const query = args.join(' ').trim();

        if (!query) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Usage: ${prefix}song <song name or YouTube URL>`)
            }, { quoted: msg });
        }

        await conn.sendMessage(from, {
            text: fancy(`🎵 Processing: ${query}...`)
        }, { quoted: msg });

        try {
            const song = await fetchYtMp3(query);

            const audioRes = await axios.get(song.url, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: 64 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': '*/*'
                }
            });

            const buffer = Buffer.from(audioRes.data);

            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${(song.title || 'song').slice(0, 60)}.mp3`,
                ptt: false
            }, { quoted: msg });

            const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
            const caption =
                `╭─〔 🎧 ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ 〕\n│\n` +
                `│ 🎤 ${song.title}\n` +
                `│ 🎙 ${song.uploader}\n` +
                `│ ⏱ ${song.duration || '—'}\n` +
                `│ 💾 ${sizeMB} MB\n│\n` +
                `│ 🔗 via ${song.provider}\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text: caption }, { quoted: msg });

        } catch (e) {
            console.error('[song] error:', e.message);
            await conn.sendMessage(from, {
                text: fancy('❌ Download failed. Try again.')
            }, { quoted: msg });
        }
    }
};