// lib/payments.js
const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");

// ============================================
//   PACKAGES
// ============================================
const PACKAGES = {
    starter:  { credits: 100,   amount: 500,   currency: "KES" }, // 5.00 KES
    basic:    { credits: 500,   amount: 2000,  currency: "KES" }, // 20.00 KES
    pro:      { credits: 1500,  amount: 5000,  currency: "KES" }, // 50.00 KES
    business: { credits: 5000,  amount: 15000, currency: "KES" }  // 150.00 KES
};

// ============================================
//   INVOICE MODEL
// ============================================
const InvoiceSchema = new mongoose.Schema({
    accountId: { type: String, required: true, index: true },
    provider: { type: String, required: true }, // "stripe" | "paystack"
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "KES" },
    credits: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    paidAt: { type: Date },
    meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);

// ============================================
//   PAYSTACK
// ============================================
async function paystackCheckout(accountId, packageKey, email) {
    const pkg = PACKAGES[packageKey];
    if (!pkg) throw new Error("Invalid package");

    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("PAYSTACK_SECRET_KEY not set");

    const reference = `PS_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const res = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
            email,
            amount: pkg.amount * 100, // Paystack uses kobo/cents
            currency: pkg.currency,
            reference,
            callback_url: `${process.env.PUBLIC_URL || "http://localhost:3000"}/dashboard`
        },
        {
            headers: { Authorization: `Bearer ${key}` }
        }
    );

    if (!res.data?.status) throw new Error(res.data?.message || "Paystack failed");

    await Invoice.create({
        accountId,
        provider: "paystack",
        reference,
        amount: pkg.amount,
        currency: pkg.currency,
        credits: pkg.credits,
        status: "pending"
    });

    return {
        url: res.data.data.authorization_url,
        reference
    };
}

function verifyPaystackSignature(req) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) return false;

    const signature = req.headers["x-paystack-signature"];
    if (!signature) return false;

    const hash = crypto
        .createHmac("sha512", key)
        .update(JSON.stringify(req.body))
        .digest("hex");

    return hash === signature;
}

async function handlePaystackWebhook(event) {
    if (event?.event !== "charge.success") return false;

    const reference = event.data.reference;
    const invoice = await Invoice.findOne({ reference });

    if (!invoice || invoice.status === "paid") return false;

    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.meta = event.data;
    await invoice.save();

    // Add credits to account
    const { Account } = require("../database/models");
    const account = await Account.findById(invoice.accountId);
    if (account) {
        account.credits += invoice.credits;
        await account.save();
    }

    return true;
}

// ============================================
//   STRIPE
// ============================================
async function stripeCheckout(accountId, packageKey, email) {
    const pkg = PACKAGES[packageKey];
    if (!pkg) throw new Error("Invalid package");

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");

    const reference = `ST_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${process.env.PUBLIC_URL || "http://localhost:3000"}/dashboard`);
    params.append("cancel_url", `${process.env.PUBLIC_URL || "http://localhost:3000"}/dashboard`);
    params.append("customer_email", email);
    params.append("line_items[0][price_data][currency]", pkg.currency.toLowerCase());
    params.append("line_items[0][price_data][product_data][name]", `${pkg.credits} Credits`);
    params.append("line_items[0][price_data][unit_amount]", Math.round(pkg.amount * 100));
    params.append("line_items[0][quantity]", "1");
    params.append("metadata[accountId]", accountId);
    params.append("metadata[credits]", pkg.credits);
    params.append("client_reference_id", reference);

    const res = await axios.post(
        "https://api.stripe.com/v1/checkout/sessions",
        params,
        {
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
    );

    await Invoice.create({
        accountId,
        provider: "stripe",
        reference,
        amount: pkg.amount,
        currency: pkg.currency,
        credits: pkg.credits,
        status: "pending"
    });

    return {
        url: res.data.url,
        reference
    };
}

async function handleStripeWebhook(event) {
    if (event?.type !== "checkout.session.completed") return false;

    const session = event.data.object;
    const reference = session.client_reference_id;

    const invoice = await Invoice.findOne({ reference });
    if (!invoice || invoice.status === "paid") return false;

    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.meta = session;
    await invoice.save();

    // Add credits
    const { Account } = require("../database/models");
    const account = await Account.findById(invoice.accountId);
    if (account) {
        account.credits += invoice.credits;
        await account.save();
    }

    return true;
}

// ============================================
//   GET INVOICES (FOR DASHBOARD)
// ============================================
async function getInvoices(limit = 50) {
    try {
        const invoices = await Invoice.find({})
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return invoices;
    } catch (e) {
        console.error("[payments] getInvoices error:", e.message);
        return [];
    }
}

module.exports = {
    PACKAGES,
    Invoice,
    paystackCheckout,
    verifyPaystackSignature,
    handlePaystackWebhook,
    stripeCheckout,
    handleStripeWebhook,
    getInvoices
};