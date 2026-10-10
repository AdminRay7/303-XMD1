// lib/apiKeys.js
// Manage per-account API keys and gate the public /api/v1/* routes.

const crypto = require("crypto");
const mongoose = require("mongoose");
const config = require("../config");

// ------------------------------------------------------------
//   SCHEMA — stored in its own collection
// ------------------------------------------------------------
const ApiKeySchema = new mongoose.Schema({
    accountId:   { type: String, index: true, required: true, unique: true },
    label:       { type: String, default: "default" },
    hash:        { type: String, required: true, index: true },
    preview:     { type: String },
    usageCount:  { type: Number, default: 0 },
    lastUsed:    { type: Date, default: null },
    createdAt:   { type: Date, default: Date.now },
    revokedAt:   { type: Date, default: null }
}, { timestamps: true });

const ApiKey = mongoose.models.ApiKey || mongoose.model("ApiKey", ApiKeySchema);

// ------------------------------------------------------------
//   HELPERS
// ------------------------------------------------------------
function sha256(str) {
    return crypto.createHash("sha256").update(str).digest("hex");
}

function generateRaw() {
    return "xmd_" + crypto.randomBytes(24).toString("hex");
}

// ------------------------------------------------------------
//   PUBLIC API
// ------------------------------------------------------------
async function getKeyInfo(accountId) {
    const doc = await ApiKey.findOne({ accountId }).lean();
    if (!doc) return { exists: false };
    return {
        exists: true,
        preview: doc.preview,
        label: doc.label,
        usageCount: doc.usageCount || 0,
        lastUsed: doc.lastUsed,
        createdAt: doc.createdAt
    };
}

async function createOrRotateKey(accountId, label = "default") {
    const raw = generateRaw();
    const hash = sha256(raw);
    const preview = raw.slice(0, 12) + "…" + raw.slice(-4);

    await ApiKey.findOneAndUpdate(
        { accountId },
        {
            $set: {
                hash,
                preview,
                label,
                usageCount: 0,
                lastUsed: null,
                revokedAt: null,
                createdAt: new Date()
            }
        },
        { upsert: true, new: true }
    );

    return { raw, preview };
}

// ------------------------------------------------------------
//   MIDDLEWARE — /api/v1/* authentication
// ------------------------------------------------------------
async function requireApiKeyV1(req, res, next) {
    try {
        // Accept key in 3 places
        let raw =
            (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() ||
            req.headers["x-api-key"] ||
            req.query.key ||
            req.query.apiKey;

        if (!raw) {
            return res.status(401).json({ error: "Missing API key" });
        }

        raw = String(raw).trim();
        const hash = sha256(raw);

        const keyDoc = await ApiKey.findOne({ hash }).lean();
        if (!keyDoc) {
            return res.status(401).json({ error: "Invalid or revoked API key" });
        }

        const { Account } = require("../database/models");
        const account = await Account.findById(keyDoc.accountId).select("-password").lean();
        if (!account) {
            return res.status(401).json({ error: "Account not found" });
        }
        if (account.isBanned) {
            return res.status(403).json({ error: "Account is banned" });
        }

        // Fire-and-forget usage tracking
        ApiKey.updateOne(
            { _id: keyDoc._id },
            { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        ).catch(() => {});

        const email = (account.email || "").toLowerCase();
        const isAdmin =
            account.isAdmin === true ||
            (Array.isArray(config.adminEmails) && config.adminEmails.includes(email));

        req.apiKey      = keyDoc;
        req.apiAccount  = account;
        req.isApiAdmin  = isAdmin;
        next();
    } catch (e) {
        console.error("apiKeys auth error:", e.message);
        return res.status(500).json({ error: "Auth check failed" });
    }
}

module.exports = {
    getKeyInfo,
    createOrRotateKey,
    requireApiKeyV1,
    ApiKey
};