# 303-XMD
the last key  

<div align="center">

<img src="https://img.shields.io/badge/303--XMD-THE%20LAST%20KEY-00d4ff?style=for-the-badge&labelColor=000814" alt="303-XMD" />

<br/>
<br/>

# 303-XMD

**The Last Key** — an advanced multi-session WhatsApp bot built on Baileys, with a modern web dashboard, hot-reload commands, and newsletter automation.

<br/>

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-6.7.9-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-ffcc66?style=flat-square)](#license)

<br/>

[**Features**](#-features) · [**Quick Start**](#-quick-start) · [**Deploy**](#-deploy) · [**Configuration**](#-configuration) · [**Dashboard**](#-web-dashboard) · [**Support**](#-support)

<br/>

</div>

---

## ✨ Overview

**303-XMD** is a modern WhatsApp automation platform that combines:

- A **Baileys-powered bot engine** with hot-reload commands
- A **multi-session manager** handling multiple WhatsApp numbers
- A **WhatsApp-style web chat viewer** with real-time sync
- A **PWA dashboard** you can install as an app
- **Newsletter automation** for WhatsApp Channels
- **Auto-detection modules** for antidelete, antilink, antibug, and more

It's designed for developers and power users who want full control — no third-party SaaS, no subscription fees, no rate-limited APIs.

---

## 🌟 Features

<table>
<tr>
<td width="50%" valign="top">

### 🔐 Authentication
- Email + password registration
- JWT-based sessions
- Admin role detection by email
- Per-user session ownership
- Banned-account protection

### 💬 Bot Engine
- Baileys 6.7.9 (WhatsApp Web)
- **Hot-reload commands** — no restart needed
- Multi-session (up to 12 numbers)
- Auto-detection modules
- Per-session config overrides
- Graceful reconnect + watchdog

### 📡 Newsletter Bot
- Auto-subscribe to your channel
- Auto-react to channel posts
- Log every post to MongoDB
- Forward posts to owner / groups
- Cross-post to Telegram/Discord via webhook

</td>
<td width="50%" valign="top">

### 🌐 Web Dashboard
- PWA installable
- WhatsApp-style chat viewer
- Real-time SSE live monitor
- Session health indicator
- Dark themed + responsive
- Gradient per page

### 🛡️ Security Suite
- Antidelete (message recovery)
- Antilink (group link blocker)
- Antibug (malicious unicode)
- Antispam (rate limit)
- Antimedia (per-type blocking)
- Anticall (auto-reject)

### 🔌 Public API
- REST API for external scripts
- API keys per account
- Admin bypass keys
- Send text + media
- Check WhatsApp numbers

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18.0.0 |
| MongoDB | Atlas or local |
| npm / yarn | Latest |
| Git | Latest |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/AdminRay7/303-XMD1.git
cd 303-XMD1

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env    # edit with your values

# 4. Start the bot
npm start