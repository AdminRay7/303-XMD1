const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    jid: { type: String, unique: true },
    name: String,
    sessionId: String,
    lastActive: Date,
    messageCount: { type: Number, default: 0 },
    spamCount: { type: Number, default: 0 },
    lastMessageTime: Number
});

const ChannelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, unique: true },
    name: String,
    subscribedAt: Date,
    lastActive: Date,
    isActive: { type: Boolean, default: true },
    autoFollow: { type: Boolean, default: true }
});

const ChannelPostSchema = new mongoose.Schema({
    msgId:     { type: String, index: true },
    serverId:  Number,
    jid:       { type: String, index: true },
    text:      String,
    type:      String,
    timestamp: { type: Date, index: true },
    raw:       Object
}, { timestamps: true });

module.exports = {
    User:              mongoose.model("User", UserSchema),
    ChannelSubscriber: mongoose.model("ChannelSubscriber", ChannelSubscriberSchema),
    ChannelPost:       mongoose.model("ChannelPost", ChannelPostSchema)
};