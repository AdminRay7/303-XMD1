// lib/aiChat.js
// Provider-agnostic chatbot. Works with OpenAI, Groq, Gemini, or Ollama.
// Falls back gracefully if the endpoint isn't configured.

const axios = require("axios");
const config = require("../config");

// ---- Fallback key (used if env var is missing or broken) ----
const FALLBACK_API_KEY = "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";

// ---------- Per-session conversation memory ----------
const conversations = new Map(); // sessionId -> [{role, content}, ...]

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

// ---------- Provider request ----------
async function askAI(message, sessionId, systemPrompt) {
    const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

    // Use env key if it exists AND isn't blank
    const envKey = (process.env.AI_API_KEY || "").trim();
    const apiKey = envKey.length > 10 ? envKey : FALLBACK_API_KEY;

    const model   = process.env.AI_MODEL || "llama-3.3-70b-versatile";
    const baseUrl = process.env.AI_BASE_URL || "https://api.groq.com/openai/v1";

    if (!apiKey && provider !== "ollama") {
        console.error("[aiChat] no API key available");
        return null;
    }

    const history = getHistory(sessionId);
    const sys = systemPrompt || `You are 303-XMD, a friendly WhatsApp assistant. Keep replies under 300 chars unless asked for detail.`;

    try {
        if (provider === "gemini") {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const contents = [
                { role: "user", parts: [{ text: sys }] },
                ...history.map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
                { role: "user", parts: [{ text: message }] }
            ];
            const r = await axios.post(url, { contents }, { timeout: 30000 });
            const out = r.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (out) {
                pushTurn(sessionId, "user", message);
                pushTurn(sessionId, "assistant", out);
            }
            return out;
        }

        if (provider === "ollama") {
            const r = await axios.post(`${baseUrl}/api/chat`, {
                model,
                messages: [
                    { role: "system", content: sys },
                    ...history,
                    { role: "user", content: message }
                ],
                stream: false
            }, { timeout: 60000 });
            const out = r.data?.message?.content || null;
            if (out) {
                pushTurn(sessionId, "user", message);
                pushTurn(sessionId, "assistant", out);
            }
            return out;
        }

        // OpenAI / Groq / any OpenAI-compatible endpoint
        const r = await axios.post(`${baseUrl}/chat/completions`, {
            model,
            messages: [
                { role: "system", content: sys },
                ...history,
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 400
        }, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 30000
        });

        const out = r.data?.choices?.[0]?.message?.content?.trim() || null;
        if (out) {
            pushTurn(sessionId, "user", message);
            pushTurn(sessionId, "assistant", out);
        }
        return out;
    } catch (e) {
        const status = e.response?.status;
        const data = e.response?.data;
        console.error("[aiChat] request failed:", status || "", e.message);
        if (data) console.error("[aiChat] response body:", JSON.stringify(data).slice(0, 300));
        return null;
    }
}

module.exports = { askAI, clearHistory, getHistory };