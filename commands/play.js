// commands/play.js
// Hardcoded — no env dependency.
// Usage: .play <song name or youtube URL>

const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

// ===== HARDCODED (no env) =====
const RAPIDAPI_KEY    = 'eae3a83c15msh69a6323638e111fp1cfb10jsna8bbd4863ac0';
const RAPIDAPI_HOST   = 'youtube-mp36.p.rapidapi.com';
const SEARCH_API_HOST = 'youtube-v31.p.rapidapi.com';

function extractVideoId(input) {
    if (!input) return null;
    const urlMatch = input.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([A-Za-z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(input.trim())) return input.trim();
    return null;
}

async function searchYouTube(query) {
    const { data } = await axios.get(
        `https://${SEARCH_API_HOST}/search`,
        {
            params: { q: query, part: 'snippet', maxResults: 1, type: 'video' },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': SEARCH_API_HOST
            },
            timeout: 15000
        }
    );
    return data?.items?.[0]?.id?.videoId || null;
}

async function fetchMP3(videoId) {
    const url = `https://${RAPIDAPI_HOST}/dl?id=${videoId}`;
    console.log('[play] fetching:', url);
    const { data } = await axios.get(url, {
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY,
            'X-RapidAPI-Host': RAPIDAPI_HOST
        },
        timeout: 30000
    });
    console.log('[play] api response:', JSON.stringify(data).slice(0, 200));
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

        const wait = await conn.sendMessage(from, { text: fancy('🔎 Searching...') }, { quoted: msg });

        try {
            let videoId = extractVideoId(query);
            if (!videoId) videoId = await searchYouTube(query);
            if (!videoId) throw new Error('No results found');

            console.log('[play] videoId:', videoId);
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
                text: fancy(`🎵 *${info.title}*\n⏱️ ${mins}:${String(secs).padStart(2, '0')}  •  📦 ${sizeMB} MB`)
            }, { quoted: msg });

        } catch (e) {
            console.error('[play] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};