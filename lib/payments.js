// lib/payments.js
// Payment handlers for Stripe and Paystack.

const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Account } = require("../database/models");

const InvoiceSchema = new mongoose.Schema({
    accountId:  { type: String, index: true, required: true },
    provider:   { type: String, enum: ["stripe", "paystack"], required: true },
    reference:  { type: String, index: true, unique: true },
    amount:     Number,
    currency:   String,
    credits:    Number,
    status:     { type: String, default: "pending" },
    paidAt:     Date,
    meta:       Object,
    timestamp:  { type: Date, default: Date.now }
}, { timestamps: true });

const Invoice = mongoose.models.Invoice ||
    mongoose.model("Invoice", InvoiceSchema);

const PACKAGES = {
    starter:  { credits: 100,  amount: 500,   currency: "KES" },
    basic:    { credits: 500,  amount: 2000,  currency: "KES" },
    pro:      { credits: 1500, amount: 5000,  currency: "KES" },
    business: { credits: 5000, amount: 15000, currency: "KES" }
};

async function paystackCheckout(accountId, packageKey, email) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("PAYSTACK_SECRET_KEY not set");
    const pkg = PACKAGES[packageKey];
    if (!pkg) throw new Error("Unknown package");

    const ref = `xmd_${Date.now()}_${accountId.slice(-6)}`;

    const r = await axios.post("https://api.paystack.co/transaction/initialize", {
        email,
        amount: pkg.amount * 100,
        currency: pkg.currency,
        reference: ref,
        metadata: { accountId, packageKey, credits: pkg.credits }
    }, {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15000
    });

    await Invoice.create({
        accountId, provider: "paystack", reference: ref,
        amount: pkg.amount, currency: pkg.currency,
        credits: pkg.credits, status: "pending",
        meta: { packageKey }
    });

    return r.data?.data;
}

function verifyPaystackSignature(req) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return false;
    const hash = crypto.createHmac("sha512", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");
    return hash === req.headers["x-paystack-signature"];
}

async function handlePaystackWebhook(event) {
    if (event?.event !== "charge.success") return false;
    const ref = event.data?.reference;
    if (!ref) return false;

    const inv = await Invoice.findOne({ reference: ref });
    if (!inv || inv.status === "paid") return false;

    inv.status = "paid";
    inv.paidAt = new Date();
    await inv.save();

    await Account.findByIdAndUpdate(inv.accountId, { $inc: { credits: inv.credits } });
    return true;
}

async function stripeCheckout(accountId, packageKey, email) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    const pkg = PACKAGES[packageKey];
    if (!pkg) throw new Error("Unknown package");

    const ref = `xmd_${Date.now()}_${accountId.slice(-6)}`;
    const body = new URLSearchParams({
        "mode": "payment",
        "success_url": `${process.env.PUBLIC_URL || "http://localhost:3000"}/dashboard?paid=1`,
        "cancel_url": `${process.env.PUBLIC_URL || "http://localhost:3000"}/dashboard?paid=0`,
        "customer_email": email,
        "client_reference_id": ref,
        "line_items[0][price_data][currency]": pkg.currency.toLowerCase(),
        "line_items[0][price_data][product_data][name]": `${pkg.credits} credits · 303-XMD`,
        "line_items[0][price_data][unit_amount]": String(pkg.amount * 100),
        "line_items[0][quantity]": "1"
    });

    const r = await axios.post("https://api.stripe.com/v1/checkout/sessions", body, {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000
    });

    await Invoice.create({
        accountId, provider: "stripe", reference: ref,
        amount: pkg.amount, currency: pkg.currency,
        credits: pkg.credits, status: "pending",
        meta: { packageKey }
    });

    return { checkout_url: r.data?.url, reference: ref };
}

async function handleStripeWebhook(event) {
    if (event?.type !== "checkout.session.completed") return false;
    const ref = event.data?.object?.client_reference_id;
    if (!ref) return false;

    const inv = await Invoice.findOne({ reference: ref });
    if (!inv || inv.status === "paid") return false;

    inv.status = "paid";
    inv.paidAt = new Date();
    await inv.save();

    await Account.findByIdAndUpdate(inv.accountId, { $inc: { credits: inv.credits } });
    return true;
}

module.exports = {
    PACKAGES,
    Invoice,
    paystackCheckout,
    verifyPaystackSignature,
    handlePaystackWebhook,
    stripeCheckout,
    handleStripeWebhook
};
