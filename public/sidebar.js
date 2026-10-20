// ============================================================
//   303-XMD — Global App Sidebar + Theme Auto-Loader
//   Admin is detected strictly by email.
// ============================================================
(function () {
    const ADMIN_EMAIL = 'ryanobanga243@gmail.com';

    const path = location.pathname.toLowerCase().replace(/\/$/, '') || '/';
    const file = (path.split('/').pop() || 'index').replace('.html', '');
    const name = file || 'index';

    // Public pages — no sidebar, no forced theme
    const PUBLIC = ['', 'index', 'login', 'register', 'app', 'mobile'];
    if (PUBLIC.includes(name)) return;

    // ---- THEME MAPPING ----
    const THEMES = {
        dashboard:         'theme-dashboard',
        store:             'theme-store',
        appstore:          'theme-store',
        pair:              'theme-pair',
        channel:           'theme-channel',
        live:              'theme-live',
        web:               'theme-web',
        settings:          'theme-settings',
        profile:           'theme-profile',
        admin:             'theme-admin',
        'admin-sessions':  'theme-sessions',
        'admin-commands':  'theme-commands',
        'admin-users':     'theme-users',
        'admin-broadcast': 'theme-broadcast',
        'admin-takeover':  'theme-takeover',
        'admin-abuse':     'theme-abuse',
        'admin-audit':     'theme-audit',
        'admin-analytics': 'theme-analytics',
        'admin-backup':    'theme-backup',
        'admin-payments':  'theme-payments',
        'admin-ai':        'theme-ai',
        'admin-appstore':  'theme-admin', // Added for App Store Upload
        'api-docs':        'theme-api',
        'api-dics':        'theme-api'
    };
    document.body.classList.add(THEMES[name] || 'theme-dashboard');
    document.documentElement.style.background = '#000';

    // ---- USER + EMAIL-BASED ADMIN CHECK ----
    let user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
    const email = (user.email || user.name || '').trim().toLowerCase();
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    const initial = (email.charAt(0) || 'U').toUpperCase();

    // ---- NAV ITEMS ----
    const NAV = [
        { sec: 'Main' },
        { id: 'dashboard', href: '/dashboard', icon: 'fa-gauge-high',      label: 'Dashboard' },
        { id: 'pair',      href: '/pair',      icon: 'fa-link',            label: 'Pair Device' },
        { id: 'channel',   href: '/channel',   icon: 'fa-tower-broadcast', label: 'Channel' },
        { id: 'web',       href: '/web',       icon: 'fa-comments',        label: 'Web Chat' },

        { sec: 'Account' },
        { id: 'store',     href: '/store',     icon: 'fa-shopping-cart',   label: 'Buy Credits' },
        { id: 'appstore',  href: '/appstore',  icon: 'fa-store',           label: 'App Store' },
        { id: 'profile',   href: '/profile',   icon: 'fa-user',            label: 'My Profile' },
        { id: 'live',      href: '/live',      icon: 'fa-satellite-dish',  label: 'Live Monitor' },
        { id: 'settings',  href: '/settings',  icon: 'fa-gear',            label: 'Settings' },

        { sec: 'Admin', admin: true },
        { id: 'admin',             href: '/admin',             icon: 'fa-shield-halved',  label: 'Admin Panel',        admin: true },
        { id: 'admin-appstore',    href: '/admin-appstore',    icon: 'fa-upload',         label: 'Upload App',         admin: true },
        { id: 'admin-sessions',    href: '/admin-sessions',    icon: 'fa-plug',           label: 'Sessions Control',   admin: true },
        { id: 'admin-takeover',    href: '/admin-takeover',    icon: 'fa-masks-theater',  label: 'Session Takeover',   admin: true },
        { id: 'admin-commands',    href: '/admin-commands',    icon: 'fa-bolt',           label: 'Commands Playground', admin: true },
        { id: 'admin-users',       href: '/admin-users',       icon: 'fa-users',          label: 'Users',              admin: true },
        { id: 'admin-broadcast',   href: '/admin-broadcast',   icon: 'fa-bullhorn',       label: 'Broadcast',          admin: true },
        { id: 'admin-abuse',       href: '/admin-abuse',       icon: 'fa-triangle-exclamation', label: 'Anti-Abuse',   admin: true },
        { id: 'admin-analytics',   href: '/admin-analytics',   icon: 'fa-chart-line',     label: 'Analytics',          admin: true },
        { id: 'admin-audit',       href: '/admin-audit',       icon: 'fa-scroll',         label: 'Audit Log',          admin: true },
        { id: 'admin-backup',      href: '/admin-backup',      icon: 'fa-box-archive',    label: 'Backup',             admin: true },
        { id: 'admin-payments',    href: '/admin-payments',    icon: 'fa-credit-card',    label: 'Payments',           admin: true },
        { id: 'admin-ai',          href: '/admin-ai',          icon: 'fa-robot',          label: 'AI Control',         admin: true },
        { id: 'api-docs',          href: '/api-docs',          icon: 'fa-code',           label: 'API Docs',           admin: true }
    ];

    let navHtml = '';
    for (const item of NAV) {
        if (item.sec) {
            if (item.admin && !isAdmin) continue;
            navHtml += `<div class="app-nav-label">${item.sec}</div>`;
            continue;
        }
        if (item.admin && !isAdmin) continue;
        const isActive = item.id === name
            || (item.id === 'api-docs' && name === 'api-dics');
        navHtml += `<a href="${item.href}" class="app-nav-item${isActive ? ' active' : ''}">
            <i class="fas ${item.icon}"></i>
            <span>${item.label}</span>
        </a>`;
    }

    const sidebarHtml = `
        <aside class="app-sidebar" id="appSidebar">
            <div class="app-brand">
                <div class="app-brand-logo"><i class="fas fa-key"></i></div>
                <div class="app-brand-text">
                    <h1>303-XMD</h1>
                    <p>v2 · The Last Key</p>
                </div>
            </div>
            <nav class="app-nav">${navHtml}</nav>
            <div class="app-foot">
                <a href="/profile" class="app-user" style="text-decoration:none;color:inherit">
                    <div class="app-user-avatar">${initial}</div>
                    <div class="app-user-info">
                        <div class="app-user-email">${escapeHtml(email || 'guest')}</div>
                        <div class="app-user-role">${isAdmin ? 'Administrator' : 'User'}</div>
                    </div>
                </a>
                <button class="app-logout" id="appLogoutBtn">
                    <i class="fas fa-right-from-bracket"></i> Logout
                </button>
            </div>
        </aside>
        <button class="sidebar-toggle" id="sidebarToggle" aria-label="Menu">
            <i class="fas fa-bars"></i>
        </button>
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
    `;

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function inject() {
        const mount = document.getElementById('appSidebarMount');
        if (mount) mount.outerHTML = sidebarHtml;
        else document.body.insertAdjacentHTML('afterbegin', sidebarHtml);

        const sidebar = document.getElementById('appSidebar');
        const toggle  = document.getElementById('sidebarToggle');
        const overlay = document.getElementById('sidebarOverlay');
        const logout  = document.getElementById('appLogoutBtn');

        toggle?.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        });
        overlay?.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
        logout?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!confirm('Log out of 303-XMD?')) return;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            location.href = '/login';
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();