const { fancy } = require('../lib/font');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// ===================== LYRICS FETCHER =====================
async function fetchLyrics(title, artist) {
    // Try LyricsOVH first (free, no key)
    try {
        const r = await axios.get('https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(title), { timeout: 8000 });
        if (r.data?.lyrics) return r.data.lyrics.trim();
    } catch {}

    // Fallback to LRCLIB (free, no key, also has synced lyrics)
    try {
        const r = await axios.get('https://lrclib.net/api/search', {
            params: { q: `${title} ${artist}` },
            timeout: 8000
        });
        if (r.data?.[0]?.plainLyrics) return r.data[0].plainLyrics.trim();
    } catch {}

    return null;
}

function splitArtistTitle(uploader, title) {
    // Try to guess artist from uploader or title "Artist - Song"
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
    name: 'play',
    category: 'download',
    aliases: ['music', 'mp3', 'playsong'],
    description: 'Search and download a song as MP3 audio (with lyrics)',

    async execute(conn, msg, args, ctx) {
        const { from, prefix } = ctx;
        const query = args.join(' ').trim();

        const searchQuery = query || 'top hits 2025';

        const tmpDir = path.join(os.tmpdir(), `xmd_play_${Date.now()}`);
        await fs.ensureDir(tmpDir);
        const outTemplate = path.join(tmpDir, '%(title)s.%(ext)s');

        let meta = null;
        let buffer = null;
        let downloaded = false;

        // ---------- ATTEMPT 1: yt-dlp download ----------
        try {
            const cmd = `yt-dlp "ytsearch1:${searchQuery}" --no-playlist -x --audio-format mp3 --audio-quality 0 --embed-thumbnail --add-metadata -o "${outTemplate}" --print-json --no-warnings --ignore-errors --retries 3 --socket-timeout 30`;
            const { stdout } = await execAsync(cmd, { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });

            const lines = stdout.trim().split('\n').filter(Boolean);
            if (lines.length) meta = JSON.parse(lines[lines.length - 1]);

            const files = await fs.readdir(tmpDir);
            if (files.length) {
                buffer = await fs.readFile(path.join(tmpDir, files[0]));
                downloaded = true;
            }
        } catch (err) {
            console.error('play download error:', err.message);
        }

        // ---------- ATTEMPT 2: Fallback to Spotify search for metadata ----------
        if (!meta) {
            try {
                const r = await axios.get('https://pika-spotify.vercel.app/search/', {
                    params: { q: searchQuery, limit: 1 }, timeout: 10000
                });
                const track = r.data?.results?.[0] || r.data?.[0];
                if (track) {
                    meta = {
                        title: track.name,
                        uploader: track.artists?.join(', '),
                        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
                        webpage_url: track.external_urls?.spotify,
                        thumbnail: track.album?.images?.[0]?.url
                    };
                }
            } catch {}
        }

        // ---------- Build metadata ----------
        const title = meta?.title || searchQuery;
        const uploader = meta?.uploader || 'Unknown';
        const duration = meta?.duration || null;
        const sourceUrl = meta?.webpage_url || '';
        const thumbnail = meta?.thumbnail || null;

        // ---------- Fetch lyrics ----------
        const { artist: guessArtist, title: guessTitle } = splitArtistTitle(uploader, title);
        const lyrics = await fetchLyrics(guessTitle, guessArtist).catch(() => null);

        // ---------- Send audio ----------
        if (downloaded && buffer) {
            const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mp4',
                fileName: `${safeName(title)}.mp3`,
                ptt: false
            }, { quoted: msg });

            const caption =
                `╭─〔 🎵 ᴍᴜꜱɪᴄ 〕\n│\n` +
                `│ 🎤 Title:  ${title}\n` +
                `│ 🎙 Artist: ${uploader}\n` +
                `│ ⏱ Duration: ${formatDuration(duration)}\n` +
                `│ 💾 Size:   ${sizeMB} MB\n` +
                (sourceUrl ? `│ 🔗 Source: ${sourceUrl}\n` : '') +
                `│\n` +
                (lyrics ? `│ 📝 ʟʏʀɪᴄꜱ\n│\n│ ${lyrics.slice(0, 3000)}\n│\n` : '') +
                `╰──────────────────────`;

            await conn.sendMessage(from, { text: caption }, { quoted: msg });
        } else {
            // Even if download failed, still send info + lyrics
            const caption =
                `╭─〔 🎵 ꜱᴏɴɢ ɪɴꜰᴏ 〕\n│\n` +
                `│ 🎤 Title:  ${title}\n` +
                `│ 🎙 Artist: ${uploader}\n` +
                `│ ⏱ Duration: ${formatDuration(duration)}\n` +
                (thumbnail ? `│ 🖼 Thumb:  ${thumbnail}\n` : '') +
                (sourceUrl ? `│ 🔗 Link:   ${sourceUrl}\n` : '') +
                `│\n` +
                (lyrics ? `│ 📝 ʟʏʀɪᴄꜱ\n│\n│ ${lyrics.slice(0, 3000)}\n│\n` : '') +
                `│ 💡 Try a different spelling for a downloadable result.\n│\n` +
                `╰──────────────────────`;

            if (thumbnail) {
                try {
                    await conn.sendMessage(from, { image: { url: thumbnail }, caption }, { quoted: msg });
                } catch {
                    await conn.sendMessage(from, { text: caption }, { quoted: msg });
                }
            } else {
                await conn.sendMessage(from, { text: caption }, { quoted: msg });
            }
        }

        await fs.remove(tmpDir).catch(() => {});
    }
};

function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function safeName(s) {
    return String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}