// lib/aiChat.js
const axios = require("axios");
const config = require("../config");
const FormData = require("form-data");

const FALLBACK_API_KEY = ""; 

const conversations = new Map();

function getHistory(sessionId) {
    return conversations.get(sessionId) || [];
}

function pushTurn(sessionId, role, content) {
    let hist = conversations.get(sessionId);
    if (!hist) { hist = []; conversations.set(sessionId, hist); }
    hist.push({ role, content: String(content).slice(0, 2000) });
    if (hist.length > 20) hist.splice(0, hist.length - 20);
}

function clearHistory(sessionId) {
    conversations.delete(sessionId);
}

// ============================================================
//   VOICE TRANSCRIPTION (Groq Whisper)
// ============================================================
async function transcribeAudio(audioBuffer) {
    const envKey = (process.env.AI_API_KEY || "").trim();
    const apiKey = envKey.length > 10 ? envKey : FALLBACK_API_KEY;
    if (!apiKey) return null;

    try {
        const form = new FormData();
        // We name it 'audio.ogg' because WhatsApp voice notes are OGG Opus
        form.append("file", audioBuffer, { filename: "audio.ogg", contentType: "audio/ogg" });
        form.append("model", "whisper-large-v3");

        const r = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", form, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                ...form.getHeaders()
            },
            timeout: 30000
        });

        return r.data?.text || null;
    } catch (e) {
        console.error("[aiChat] transcribe failed:", e.response?.data || e.message);
        return null;
    }
}

async function askAI(message, sessionId, systemPrompt) {
    const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
    const envKey = (process.env.AI_API_KEY || "").trim();
    const apiKey = envKey.length > 10 ? envKey : FALLBACK_API_KEY;

    const model   = process.env.AI_MODEL || "openai/gpt-oss-20b";
    const baseUrl = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";

    if (!apiKey && provider !== "ollama") {
        console.error("[aiChat] no API key available");
        return null;
    }

    const history = getHistory(sessionId);
    const sys = systemPrompt || `You are 303-XMD, a friendly WhatsApp assistant. Keep replies under 300 chars unless asked for detail.`;

    try {
        // OpenAI / Groq / any OpenAI-compatible endpoint
        const r = await axios.post(`${baseUrl}/chat/completions`, {
            model,
            messages: [
                { role: "system", content: sys },
                ...history,
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 1024
        }, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 30000
        });

        const choice = r.data?.choices?.[0]?.message;
        let out = (choice?.content || "").trim();
        if (!out && choice?.reasoning) out = choice.reasoning.trim();
        if (!out) out = null;

        if (out) {
            pushTurn(sessionId, "user", message);
            pushTurn(sessionId, "assistant", out);
        }
        return out;
    } catch (e) {
        console.error("[aiChat] request failed:", e.response?.status || "", e.message);
        return null;
    }
}

module.exports = { askAI, clearHistory, getHistory, transcribeAudio };