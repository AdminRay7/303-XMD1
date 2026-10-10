// lib/auth.js
// Password hashing + JWT sign/verify + Express auth middleware.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-this-jwt-secret-please";
const JWT_EXPIRES = "7d";

/**
 * Hash a plaintext password with bcrypt (10 rounds).
 */
async function hashPassword(plain) {
    return bcrypt.hash(plain, 10);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}

/**
 * Sign a JWT with the given payload.
 * Payload should include { id, email } for consistency.
 */
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Verify a JWT. Throws if invalid / expired.
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: reads "Authorization: Bearer <token>"
 * On success: sets req.account = { id, email }, calls next().
 * On failure: returns 401 JSON.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ error: "Login required" });
    try {
        const payload = verifyToken(token);
        req.account = { id: payload.id, email: payload.email };
        next();
    } catch {
        return res.status(401).json({ error: "Session expired or invalid" });
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken,
    requireAuth
};