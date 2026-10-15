// commands/play.js
// Search + download song from YouTube via RapidAPI.
// Usage: .play <song name or youtube URL>

const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY  || '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'youtube-mp36.p.rapidapi.com';

function extractVideoId(input) {
    if (!input) return null;
    const urlMatch = input.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([A-Za-z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim();
    return null;
}

async function searchYouTube(query) {
    const instances = [
        'https://inv.nadeko.net',
        'https://invidious.nerdvpn.de',
        'https://yewtu.be',
        'https://invidious.privacyredirect.com'
    ];
    for (const base of instances) {
        try {
            const { data } = await axios.get(
                `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
                { timeout: 8000 }
            );
            if (Array.isArray(data) && data.length) {
                return data[0].videoId;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

async function fetchMP3(videoId) {
    const { data } = await axios.get(
        `https://${RAPIDAPI_HOST}/dl?id=${videoId}`,
        {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            },
            timeout: 30000
        }
    );
    if (data.status !== 'ok' || !data.link) {
        throw new Error(data.msg || 'Download failed');
    }
    return data;
}

module.exports = {
    name: 'play',
    category: 'download',
    aliases: ['mp3', 'music'],
    description: 'Download a song as MP3',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const query = args.join(' ').trim();

        if (!query) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}play <song name or youtube URL>`)
            }, { quoted: msg });
        }
        if (!RAPIDAPI_KEY) {
            return conn.sendMessage(from, {
                text: fancy('❌ RAPIDAPI_KEY not set in Heroku Config Vars.')
            }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🔎 Searching...') }, { quoted: msg });

        try {
            let videoId = extractVideoId(query);
            if (!videoId) videoId = await searchYouTube(query);
            if (!videoId) throw new Error('No results found');

            await conn.sendMessage(from, { text: fancy('⬇️ Downloading MP3...'), edit: wait.key });
            const info = await fetchMP3(videoId);
            const sizeMB = (info.filesize / 1024 / 1024).toFixed(2);
            const mins = Math.floor(info.duration / 60);
            const secs = Math.floor(info.duration % 60);

            await conn.sendMessage(from, { text: fancy('📤 Uploading...'), edit: wait.key });

            await conn.sendMessage(from, {
                audio: { url: info.link },
                mimetype: 'audio/mpeg',
                fileName: `${info.title}.mp3`,
                ptt: false
            }, { quoted: msg });

            await conn.sendMessage(from, {
                text: fancy(
                    `🎵 *${info.title}*\n` +
                    `⏱️ ${mins}:${String(secs).padStart(2, '0')}  •  📦 ${sizeMB} MB`
                )
            }, { quoted: msg });

        } catch (e) {
            console.error('[play] error:', e.message);
            await conn.sendMessage(from, {
                text: fancy(`❌ Failed: ${e.message}`)
            }, { quoted: msg });
        }
    }
};