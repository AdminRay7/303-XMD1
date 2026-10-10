// lib/liveFeed.js
// EventEmitter-based feed used by /api/live/* and /api/web/*
// Pushes events to SSE listeners AND persists to LiveEvent collection.

const EventEmitter = require("events");
const { LiveEvent } = require("../database/models");

class LiveFeed extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0); // unlimited SSE clients
    }

    /**
     * Push a new event.
     * - Emits to all SSE listeners
     * - Persists to MongoDB (fire-and-forget)
     * @param {object} event
     */
    async push(event) {
        const enriched = {
            ...event,
            timestamp: event.timestamp || new Date().toISOString()
        };

        // Notify SSE clients first (fast path)
        try { this.emit("event", enriched); } catch (e) {
            console.error("liveFeed emit error:", e.message);
        }

        // Persist (never block the caller)
        try {
            await LiveEvent.create({
                sessionId:   enriched.sessionId,
                type:        enriched.type || "message",
                chatJid:     enriched.chatJid,
                chatName:    enriched.chatName,
                isGroup:     !!enriched.isGroup,
                senderJid:   enriched.senderJid,
                senderName:  enriched.senderName,
                senderPhone: enriched.senderPhone,
                fromMe:      !!enriched.fromMe,
                text:        enriched.text,
                mediaPath:   enriched.mediaPath,
                mediaType:   enriched.mediaType,
                mediaSize:   enriched.mediaSize,
                fileName:    enriched.fileName,
                extra:       enriched.extra || {},
                timestamp:   new Date(enriched.timestamp)
            });
        } catch (e) {
            console.error("liveFeed persist error:", e.message);
        }

        return enriched;
    }

    /**
     * Recent events from DB, optionally filtered by sessionId.
     * @param {number} limit
     * @param {string|null} sessionId
     */
    async getRecent(limit = 200, sessionId = null) {
        const filter = sessionId ? { sessionId } : {};
        const events = await LiveEvent
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        // Return in chronological order (oldest → newest)
        return events.reverse().map(e => ({
            _id:         e._id.toString(),
            sessionId:   e.sessionId,
            type:        e.type,
            chatJid:     e.chatJid,
            chatName:    e.chatName,
            isGroup:     e.isGroup,
            senderJid:   e.senderJid,
            senderName:  e.senderName,
            senderPhone: e.senderPhone,
            fromMe:      e.fromMe,
            text:        e.text,
            mediaPath:   e.mediaPath,
            mediaType:   e.mediaType,
            mediaSize:   e.mediaSize,
            fileName:    e.fileName,
            extra:       e.extra,
            timestamp:   e.timestamp
        }));
    }
}

module.exports = new LiveFeed();