// lib/adminAuth.js
// Admin gate for /api/admin/* and /api/live/* routes.
// Reads the Bearer token, looks up the account, and checks
// if it's flagged admin either by DB flag or by config.adminEmails.

const jwt = require("jsonwebtoken");
const { Account } = require("../database/models");
const config = require("../config");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-jwt-secret-please";

/**
 * Middleware: requires a valid JWT AND the account to be admin.
 * Sets req.account = { id, email } and req.isAdmin = true.
 */
async function requireAdmin(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
            return res.status(401).json({ error: "Login required" });
        }

        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Session expired or invalid" });
        }

        const account = await Account.findById(payload.id)
            .select("email isAdmin")
            .lean();
        if (!account) {
            return res.status(404).json({ error: "Account not found" });
        }

        const email = (account.email || "").toLowerCase();
        const isAdmin =
            account.isAdmin === true ||
            (Array.isArray(config.adminEmails) && config.adminEmails.includes(email));

        if (!isAdmin) {
            return res.status(403).json({ error: "Admin access required" });
        }

        req.account = { id: payload.id, email: account.email };
        req.isAdmin = true;
        next();
    } catch (e) {
        console.error("adminAuth error:", e.message);
        return res.status(500).json({ error: "Auth check failed" });
    }
}

module.exports = { requireAdmin };