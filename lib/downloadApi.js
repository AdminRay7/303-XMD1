// lib/downloadApi.js
// Public API downloader — no yt-dlp, no ffmpeg.
// Tries multiple providers until one works.

const axios = require("axios");

// ============================================================
//   PROVIDER 1 — dhamzxploit (dzx)  ·  search + mp3
// ============================================================
async function viaDzx(query) {
    const base = "https://api.dhamzxploit.my.id";
    // search
    const s = await axios.get(`${base}/youtube/search`, {
        params: { q: query },
        timeout: 15000
    });
    const results = s.data?.result || s.data?.data || [];
    if (!results.length) throw new Error("dzx: no results");
    const video = results[0];
    const videoUrl = video.url || video.link || video.videoId
        ? `https://youtu.be/${video.videoId}` : null;
    if (!videoUrl) throw new Error("dzx: no url");

    const d = await axios.get(`${base}/youtube/ytmp3`, {
        params: { url: videoUrl },
        timeout: 30000
    });
    const data = d.data?.result || d.data?.data || d.data;
    const dlUrl = data?.url || data?.download || data?.link;
    if (!dlUrl) throw new Error("dzx: no download url");

    return {
        title: data.title || video.title,
        uploader: data.author || video.author || "Unknown",
        duration: data.duration || video.duration || null,
        url: dlUrl,
        thumbnail: data.thumbnail || video.thumbnail || null,
        provider: "dzx"
    };
}

// ============================================================
//   PROVIDER 2 — api.zenzapis.xyz (youtube mp3)
// ============================================================
async function viaZenz(query) {
    const base = "https://zenzapis.xyz";
    // zenz usually uses a search endpoint
    const s = await axios.get(`${base}/search/youtube`, {
        params: { query },
        timeout: 15000
    });
    const results = s.data?.result || [];
    if (!results.length) throw new Error("zenz: no results");
    const video = results[0];

    const d = await axios.get(`${base}/download/ytmp3`, {
        params: { url: video.url },
        timeout: 30000
    });
    const data = d.data?.result || d.data;
    const dlUrl = data?.url || data?.download;
    if (!dlUrl) throw new Error("zenz: no download url");

    return {
        title: data.title || video.title,
        uploader: data.author || video.author || "Unknown",
        duration: data.duration || video.duration || null,
        url: dlUrl,
        thumbnail: data.thumbnail || video.thumbnail || null,
        provider: "zenz"
    };
}

// ============================================================
//   PROVIDER 3 — api.neoxr.my.id
// ============================================================
async function viaNeoxr(query) {
    const base = "https://api.neoxr.my.id";
    const s = await axios.get(`${base}/youtube`, {
        params: { q: query },
        timeout: 15000
    });
    const results = s.data?.data || s.data?.result || [];
    if (!results.length) throw new Error("neoxr: no results");
    const video = results[0];

    const d = await axios.get(`${base}/youtube`, {
        params: { url: video.url, type: "mp3" },
        timeout: 30000
    });
    const data = d.data?.data || d.data?.result || d.data;
    const dlUrl = data?.url || data?.download || data?.mp3;
    if (!dlUrl) throw new Error("neoxr: no download url");

    return {
        title: data.title || video.title,
        uploader: data.author || video.author || "Unknown",
        duration: data.duration || video.duration || null,
        url: dlUrl,
        thumbnail: data.thumbnail || video.thumbnail || null,
        provider: "neoxr"
    };
}

// ============================================================
//   PUBLIC — try all providers in order
// ============================================================
async function fetchYtMp3(query) {
    const providers = [
        { name: "dzx",     fn: viaDzx },
        { name: "zenz",    fn: viaZenz },
        { name: "neoxr",   fn: viaNeoxr }
    ];

    const errors = [];
    for (const p of providers) {
        try {
            console.log(`[downloadApi] trying ${p.name}...`);
            const result = await p.fn(query);
            console.log(`[downloadApi] ${p.name} OK: ${result.title}`);
            return result;
        } catch (e) {
            console.log(`[downloadApi] ${p.name} failed: ${e.message}`);
            errors.push(`${p.name}: ${e.message}`);
        }
    }
    throw new Error("All providers failed: " + errors.join(" | "));
}

module.exports = { fetchYtMp3 };