// ================== API KEY ==================
const CH_API_KEY = '303xmd_k9Xp2mQz7LvN4rT8wYbH6jF3sD1cA5eG';

// ============================================================
//  NAVIGATION
// ============================================================
const navItems = document.querySelectorAll('.nav-item');
const pages    = document.querySelectorAll('.page');
const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('overlay');
const menuBtn  = document.getElementById('menuToggle');

function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function go(pageId) {
    pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pageId === 'channel') { loadChannelInfo(); loadChannelPosts(); }
    if (pageId === 'stats')   { loadStats(); }
    if (pageId === 'home')    { loadStats(); }
}

if (navItems.length) {
    navItems.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            go(el.dataset.page);
        });
    });

    document.querySelectorAll('[data-goto]').forEach(b => {
        b.addEventListener('click', () => go(b.dataset.goto));
    });
}

if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });
}
if (overlay) {
    overlay.addEventListener('click', closeSidebar);
}

// ============================================================
//  SESSION
// ============================================================
function getSessionId() {
    let id = localStorage.getItem('xmd303_session_id');
    if (!id) {
        id = 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('xmd303_session_id', id);
    }
    return id;
}
const SESSION_ID = getSessionId();

// ============================================================
//  TOAST
// ============================================================
const toastEl = document.getElementById('toast');
function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ============================================================
//  PAIRING
// ============================================================
const submitBtn = document.getElementById('submitBtn');
const phoneNum  = document.getElementById('phoneNum');
const stepPair  = document.getElementById('step-pair');
const stepRes   = document.getElementById('step-result');
const codeBox   = document.getElementById('codeDisplay');
const errBox    = document.getElementById('err');
const copyBtn   = document.getElementById('copyBtn');
const againBtn  = document.getElementById('againBtn');

if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
        errBox.classList.remove('show');
        const num = phoneNum.value.replace(/\D/g, '');
        if (num.length < 10 || num.length > 15) {
            errBox.innerText = 'Enter full number with country code (10–15 digits)';
            errBox.classList.add('show');
            return;
        }
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
        try {
            const r = await fetch(`/api/pair?sessionId=${encodeURIComponent(SESSION_ID)}&num=${encodeURIComponent(num)}`, { cache: 'no-store' });
            const text = await r.text();
            let data;
            try { data = JSON.parse(text); } catch { throw new Error(`Server returned ${r.status}`); }
            if (!r.ok || data.error) throw new Error(data.error || `Error ${r.status}`);
            if (!data.code) throw new Error('No code returned');

            stepPair.style.display = 'none';
            stepRes.style.display = 'block';
            codeBox.innerText = data.code;
            showToast('Code generated!');
        } catch (e) {
            errBox.innerText = e.message;
            errBox.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-key"></i> Generate Pairing Code';
        }
    });
}

function copyCode() {
    const code = codeBox.innerText.replace(/-/g, '').trim();
    if (!code || code === '----') return;
    navigator.clipboard.writeText(code).then(() => showToast('Copied!')).catch(() => {});
}
if (codeBox) codeBox.addEventListener('click', copyCode);
if (copyBtn) copyBtn.addEventListener('click', copyCode);

if (againBtn) {
    againBtn.addEventListener('click', () => {
        stepRes.style.display = 'none';
        stepPair.style.display = 'block';
        phoneNum.value = '';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-key"></i> Generate Pairing Code';
        errBox.classList.remove('show');
        phoneNum.focus();
    });
}
if (phoneNum) {
    phoneNum.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
}

// ============================================================
//  CHANNEL
// ============================================================
async function chFetch(path, opts = {}) {
    const r = await fetch(path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', 'x-api-key': CH_API_KEY, ...(opts.headers || {}) },
        cache: 'no-store'
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
}

async function loadChannelInfo() {
    const pill = document.getElementById('chStatus');
    const roleTxt = document.getElementById('chRole');
    if (!pill || !roleTxt) return;
    try {
        const d = await chFetch('/api/channel/info');
        if (d.connected) {
            pill.classList.remove('off');
            roleTxt.innerText = `${d.name || 'Channel'} · ${d.role || '?'} · ${d.subscribers || '?'} subs`;
        } else {
            pill.classList.add('off');
            roleTxt.innerText = 'No active session';
        }
    } catch {
        pill.classList.add('off');
        roleTxt.innerText = 'Error';
    }
}

async function loadChannelPosts() {
    const box = document.getElementById('chPosts');
    if (!box) return;
    box.innerHTML = 'Loading…';
    try {
        const d = await chFetch('/api/channel/posts?limit=10');
        if (!d.posts.length) { box.innerHTML = '<i>No posts logged yet.</i>'; return; }
        box.innerHTML = d.posts.map(p => `
            <div class="post-item">
                <div class="date"><i class="far fa-clock"></i> ${new Date(p.timestamp).toLocaleString()}</div>
                <div class="txt">${(p.text || '[media]').slice(0, 200)}</div>
            </div>
        `).join('');
    } catch (e) {
        box.innerHTML = `<span style="color:var(--danger)">${e.message}</span>`;
    }
}

const chPostBtn = document.getElementById('chPostBtn');
if (chPostBtn) {
    chPostBtn.addEventListener('click', async () => {
        const text = document.getElementById('chText').value.trim();
        const err = document.getElementById('chErr');
        const ok  = document.getElementById('chOk');
        err.classList.remove('show'); ok.classList.remove('show');
        if (!text) { err.innerText = 'Enter text'; err.classList.add('show'); return; }
        try {
            await chFetch('/api/channel/post', { method: 'POST', body: JSON.stringify({ text }) });
            document.getElementById('chText').value = '';
            ok.innerText = '✅ Posted successfully'; ok.classList.add('show');
            showToast('Posted!');
            loadChannelPosts();
        } catch (e) {
            err.innerText = e.message; err.classList.add('show');
        }
    });
}

const chRefreshBtn = document.getElementById('chRefreshBtn');
if (chRefreshBtn) {
    chRefreshBtn.addEventListener('click', () => { loadChannelInfo(); loadChannelPosts(); });
}

// ============================================================
//  STATS
// ============================================================
function fmtUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const p = [];
    if (d) p.push(d + 'd');
    if (h) p.push(h + 'h');
    if (m) p.push(m + 'm');
    p.push(s + 's');
    return p.join(' ');
}

async function loadStats() {
    try {
        const r = await fetch('/api/stats', { cache: 'no-store' });
        const d = await r.json();

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        set('statTotal',  d.totalSessions ?? 0);
        set('statActive', d.activeSessions ?? 0);
        set('statMax',    d.maxSessions ?? 12);
        set('statUptime', fmtUptime(d.uptime || 0));
        set('homeSessions', d.totalSessions ?? 0);
        set('homeActive',   d.activeSessions ?? 0);
        set('homeUptime',   fmtUptime(d.uptime || 0));
    } catch {}
}

const refreshStatsBtn = document.getElementById('refreshStatsBtn');
if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', loadStats);

// ============================================================
//  PAIR STATUS POLL
// ============================================================
async function checkPair() {
    const pill = document.getElementById('pairStatus');
    const txt  = document.getElementById('pairStatusTxt');
    if (!pill || !txt) return;
    try {
        const r = await fetch(`/api/status?sessionId=${encodeURIComponent(SESSION_ID)}`, { cache: 'no-store' });
        const d = await r.json();
        if (d.connected) {
            pill.classList.remove('off');
            txt.innerText = 'Session connected';
        } else {
            pill.classList.add('off');
            txt.innerText = 'Not paired';
        }
    } catch {}
}

// ============================================================
//  BOOT
// ============================================================
if (document.querySelector('.page')) {
    loadStats();
    checkPair();
    setInterval(loadStats, 15000);
    setInterval(checkPair, 15000);
    if (phoneNum) phoneNum.focus();
}