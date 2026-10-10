const { fancy } = require('../lib/font');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const MAX_FILE_MB = 64;

module.exports = {
    name: 'song',
    category: 'download',
    aliases: ['mp3dl', 'songdl', 'download'],
    description: 'Download a song as MP3 audio (direct URL or search)',

    async execute(conn, msg, args, ctx) {
        const { from, prefix } = ctx;
        const query = args.join(' ').trim();

        if (!query) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Usage: ${prefix}song <song name or YouTube URL>`)
            }, { quoted: msg });
        }

        const status = await conn.sendMessage(from, {
            text: fancy(`🎵 Processing: ${query}...`)
        }, { quoted: msg });

        const tmpDir = path.join(os.tmpdir(), `xmd_song_${Date.now()}`);
        await fs.ensureDir(tmpDir);
        const outTemplate = path.join(tmpDir, '%(title)s.%(ext)s');

        // Detect direct URL vs search term
        const isUrl = /^https?:\/\//i.test(query);
        const source = isUrl ? `"${query}"` : `"ytsearch1:${query}"`;

        let meta = null;
        let buffer = null;

        try {
            const cmd = [
                'yt-dlp',
                source,
                '--no-playlist',
                '-x',
                '--audio-format mp3',
                '--audio-quality 192K',
                '--embed-thumbnail',
                '--add-metadata',
                '--no-warnings',
                '--no-check-certificate',
                '--retries 3',
                '--socket-timeout 30',
                '--max-filesize 60M',
                `-o "${outTemplate}"`,
                '--print-json'
            ].join(' ');

            const { stdout } = await execAsync(cmd, {
                timeout: 180000,
                maxBuffer: 20 * 1024 * 1024
            });

            const lines = stdout.trim().split('\n').filter(Boolean);
            if (lines.length) {
                try { meta = JSON.parse(lines[lines.length - 1]); } catch {}
            }

            const files = await fs.readdir(tmpDir);
            if (!files.length) throw new Error('yt-dlp did not produce a file');

            const audioFile = files.find(f => /\.(mp3|m4a|webm|opus|ogg)$/i.test(f)) || files[0];
            const filePath = path.join(tmpDir, audioFile);
            const stat = await fs.stat(filePath);
            const sizeMB = stat.size / 1024 / 1024;
            if (sizeMB > MAX_FILE_MB) throw new Error(`File too large (${sizeMB.toFixed(1)} MB)`);

            buffer = await fs.readFile(filePath);
        } catch (err) {
            console.error('[song] yt-dlp failed:', err.message);
        }

        if (!buffer) {
            try { await fs.remove(tmpDir); } catch {}
            return conn.sendMessage(from, {
                text: fancy('❌ Download failed. Try again in a moment.')
            }, { quoted: msg });
        }

        const title = meta?.title || query;
        const uploader = meta?.uploader || meta?.channel || 'Unknown';
        const duration = meta?.duration || null;
        const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);

        try {
            // Send as audio file with metadata thumbnail
            await conn.sendMessage(from, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${safeName(title)}.mp3`,
                ptt: false
            }, { quoted: msg });

            // Optional: also send as document if user wants to keep the file
            // Uncomment the next block if you want dual delivery:
            // await conn.sendMessage(from, {
            //     document: buffer,
            //     mimetype: 'audio/mpeg',
            //     fileName: `${safeName(title)}.mp3`
            // }, { quoted: msg });

            const caption =
                `╭─〔 🎧 ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ 〕\n│\n` +
                `│ 🎤 ${title}\n` +
                `│ 🎙 ${uploader}\n` +
                `│ ⏱ ${fmtTime(duration)}\n` +
                `│ 💾 ${sizeMB} MB\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text: caption }, { quoted: msg });
        } catch (err) {
            console.error('[song] send failed:', err.message);
            try { await fs.remove(tmpDir); } catch {}
            return conn.sendMessage(from, {
                text: fancy('❌ Failed to send audio. Try again.')
            }, { quoted: msg });
        }

        try { await fs.remove(tmpDir); } catch {}
    }
};

function fmtTime(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function safeName(s) {
    return String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}