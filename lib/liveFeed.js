// lib/liveFeed.js
// EventEmitter bus + MongoDB persistence for the Live Monitor.
// Every message (in or out) is pushed here with full metadata.

const EventEmitter = require("events");
const { LiveEvent } = require("../database/models");

class LiveFeed extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(0);
        this._memory = [];   // small ring buffer for instant /recent without Mongo hit
        this._MAX_MEM = 500;
    }

    /**
     * Push a new event.
     * @param {object} event
     *   sessionId, type, chatJid, chatName, isGroup,
     *   senderJid, senderName, senderPhone,
     *   recipientJid, recipientName, recipientPhone,
     *   fromMe, text, mediaType, mediaPath, mediaSize, fileName, extra
     */
    async push(event) {
        const enriched = {
            ...event,
            timestamp: event.timestamp || new Date().toISOString()
        };

        // Fast path — memory buffer
        this._memory.push(enriched);
        if (this._memory.length > this._MAX_MEM) this._memory.shift();

        // Emit to SSE listeners
        try { this.emit("event", enriched); } catch (e) {
            console.error("liveFeed emit error:", e.message);
        }

        // Persist to MongoDB (fire-and-forget)
        try {
            await LiveEvent.create({
                sessionId:      enriched.sessionId,
                type:           enriched.type || "message",
                chatJid:        enriched.chatJid,
                chatName:       enriched.chatName,
                isGroup:        !!enriched.isGroup,
                senderJid:      enriched.senderJid,
                senderName:     enriched.senderName,
                senderPhone:    enriched.senderPhone,
                recipientJid:   enriched.recipientJid,
                recipientName:  enriched.recipientName,
                recipientPhone: enriched.recipientPhone,
                fromMe:         !!enriched.fromMe,
                text:           enriched.text,
                mediaPath:      enriched.mediaPath,
                mediaType:      enriched.mediaType,
                mediaSize:      enriched.mediaSize,
                fileName:       enriched.fileName,
                extra:          enriched.extra || {},
                timestamp:      new Date(enriched.timestamp)
            });
        } catch (e) {
            console.error("liveFeed persist error:", e.message);
        }

        return enriched;
    }

    /**
     * Return recent events from memory (fast) or fallback to Mongo.
     */
    async getRecent(limit = 200, sessionId = null) {
        // If we have enough in memory, serve from there
        if (this._memory.length >= Math.min(limit, 100)) {
            let mem = this._memory;
            if (sessionId) mem = mem.filter(e => e.sessionId === sessionId);
            return mem.slice(-limit);
        }

        // Otherwise hit Mongo
        const filter = sessionId ? { sessionId } : {};
        const events = await LiveEvent
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return events.reverse().map(e => ({
            _id:            e._id.toString(),
            sessionId:      e.sessionId,
            type:           e.type,
            chatJid:        e.chatJid,
            chatName:       e.chatName,
            isGroup:        e.isGroup,
            senderJid:      e.senderJid,
            senderName:     e.senderName,
            senderPhone:    e.senderPhone,
            recipientJid:   e.recipientJid,
            recipientName:  e.recipientName,
            recipientPhone: e.recipientPhone,
            fromMe:         e.fromMe,
            text:           e.text,
            mediaPath:      e.mediaPath,
            mediaType:      e.mediaType,
            mediaSize:      e.mediaSize,
            fileName:       e.fileName,
            extra:          e.extra,
            timestamp:      e.timestamp
        }));
    }
}

module.exports = new LiveFeed();