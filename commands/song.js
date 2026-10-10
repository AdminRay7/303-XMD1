const { fancy } = require('../lib/font');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');

// ===================== LYRICS FETCHER =====================
async function fetchLyrics(title, artist) {
    // Try LyricsOVH first (free, no key)
    try {
        const r = await axios.get('https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(title), { timeout: 8000 });
        if (r.data?.lyrics) return r.data.lyrics.trim();
    } catch {}

    // Fallback to LRCLIB
    try {
        const r = await axios.get('https://lrclib.net/api/search', {
            params: { q: `${title} ${artist}` }, timeout: 8000
        });
        if (r.data?.[0]?.plainLyrics) return r.data[0].plainLyrics.trim();
    } catch {}

    return null;
}

function splitArtistTitle(uploader, title) {
    let artist = (uploader || '').replace(/ - Topic$/i, '').trim();
    let songTitle = title || '';
    if (!artist || artist.length > 40) {
        const m = songTitle.match(/^([^-]+)\s*-\s*(.+)$/);
        if (m) {
            artist = m[1].trim();
            songTitle = m[2].trim();
        }
    }
    return { artist, title: songTitle };
}

module.exports = {
    name: 'song',
    category: 'download',
    aliases: ['lyrics', 'songinfo', 'searchsong'],
    description: 'Search for a song and get info + lyrics (no download)',

    async execute(conn, msg, args, ctx) {
        const { from, prefix } = ctx;
        const query = args.join(' ').trim() || 'top hits 2025';

        let meta = null;

        // ---------- Try yt-dlp metadata first ----------
        try {
            const cmd = `yt-dlp "ytsearch1:${query}" --no-playlist --dump-json --skip-download --no-warnings --retries 2 --socket-timeout 30`;
            const { stdout } = await execAsync(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
            const lines = stdout.trim().split('\n').filter(Boolean);
            if (lines.length) meta = JSON.parse(lines[lines.length - 1]);
        } catch (err) {
            console.error('song meta error:', err.message);
        }

        // ---------- Fallback: Spotify metadata via free API ----------
        if (!meta) {
            try {
                const r = await axios.get('https://pika-spotify.vercel.app/search/', {
                    params: { q: query, limit: 1 }, timeout: 10000
                });
                const track = r.data?.results?.[0] || r.data?.[0];
                if (track) {
                    meta = {
                        title: track.name,
                        uploader: track.artists?.join(', '),
                        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
                        webpage_url: track.external_urls?.spotify,
                        thumbnail: track.album?.images?.[0]?.url,
                        view_count: null
                    };
                }
            } catch {}
        }

        // ---------- Absolute fallback so we never say "not found" ----------
        if (!meta) {
            meta = {
                title: query,
                uploader: 'Various Artists',
                duration: null,
                webpage_url: '',
                thumbnail: null,
                view_count: null
            };
        }

        const { artist: guessArtist, title: guessTitle } = splitArtistTitle(meta.uploader, meta.title);
        const lyrics = await fetchLyrics(guessTitle, guessArtist).catch(() => null);

        const caption =
            `╭─〔 🎵 ꜱᴏɴɢ 〕\n│\n` +
            `│ 🎤 Title:  ${meta.title}\n` +
            `│ 🎙 Artist: ${meta.uploader}\n` +
            `│ ⏱ Duration: ${formatDuration(meta.duration)}\n` +
            (meta.view_count ? `│ 👁 Views:  ${formatViews(meta.view_count)}\n` : '') +
            (meta.webpage_url ? `│ 🔗 Link:   ${meta.webpage_url}\n` : '') +
            `│\n` +
            (lyrics
                ? `│ 📝 ʟʏʀɪᴄꜱ\n│\n│ ${lyrics.slice(0, 3500)}\n│\n`
                : `│ 💡 Use ${prefix}play ${query} to download the MP3.\n│\n`
            ) +
            `╰──────────────────────`;

        if (meta.thumbnail) {
            try {
                await conn.sendMessage(from, { image: { url: meta.thumbnail }, caption }, { quoted: msg });
                return;
            } catch {}
        }

        await conn.sendMessage(from, { text: caption }, { quoted: msg });
    }
};

function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function formatViews(n) {
    if (!n) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
}