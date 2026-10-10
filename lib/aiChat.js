// lib/aiChat.js
// Provider-agnostic chatbot. Works with OpenAI, Groq, Gemini, or Ollama.

const axios = require("axios");
const config = require("../config");

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

async function askAI(message, sessionId, systemPrompt) {
    const provider = process.env.AI_PROVIDER || "openai";
    const apiKey   = process.env.AI_API_KEY;
    const model    = process.env.AI_MODEL || "gpt-4o-mini";
    const baseUrl  = process.env.AI_BASE_URL || "https://api.openai.com/v1";

    if (!apiKey && provider !== "ollama") return null;

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
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 30000
        });

        const out = r.data?.choices?.[0]?.message?.content?.trim() || null;
        if (out) {
            pushTurn(sessionId, "user", message);
            pushTurn(sessionId, "assistant", out);
        }
        return out;
    } catch (e) {
        console.error("aiChat error:", e.message);
        return null;
    }
}

module.exports = { askAI, clearHistory, getHistory };
