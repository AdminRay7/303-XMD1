// lib/auditLog.js
// Every admin action is recorded here for accountability.

const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    adminEmail:  { type: String, index: true, required: true },
    adminId:     { type: String, index: true },
    action:      { type: String, index: true, required: true },
    target:      { type: String },
    targetType:  { type: String },
    details:     { type: Object, default: {} },
    ip:          { type: String },
    userAgent:   { type: String },
    timestamp:   { type: Date, default: Date.now, index: true }
}, { timestamps: true });

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ adminEmail: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog ||
    mongoose.model("AuditLog", AuditLogSchema);

async function log(req, action, opts = {}) {
    try {
        const adminEmail = req?.account?.email || req?.headers?.["x-admin-email"] || "unknown";
        const adminId = req?.account?.id || null;

        await AuditLog.create({
            adminEmail,
            adminId,
            action,
            target: opts.target || null,
            targetType: opts.targetType || null,
            details: opts.details || {},
            ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
            userAgent: req?.headers?.["user-agent"] || null
        });
    } catch (e) {
        console.error("auditLog:", e.message);
    }
}

async function list(limit = 200, opts = {}) {
    const filter = {};
    if (opts.adminEmail) filter.adminEmail = opts.adminEmail;
    if (opts.action) filter.action = opts.action;
    const rows = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
    return rows;
}

module.exports = { log, list, AuditLog };
