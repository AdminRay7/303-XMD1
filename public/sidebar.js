// ============================================================
//   303-XMD — Global App Sidebar + Theme Auto-Loader
//
//   Usage in any logged-in page:
//     <div id="appSidebarMount"></div>
//     ...
//     <script src="/sidebar.js"></script>
//
//   The script:
//     • Detects the current page from the URL
//     • Sets <body class="theme-X"> so the whole page inherits
//       the gradient palette
//     • Injects the sidebar navigation
//     • Shows/hides admin items based on localStorage.user.isAdmin
//     • Handles mobile drawer + logout
// ============================================================
(function () {
    const path = location.pathname.toLowerCase().replace(/\/$/, '') || '/';
    const file = (path.split('/').pop() || 'index').replace('.html', '');
    const name = file || 'index';

    // Public pages — no sidebar, no forced theme
    const PUBLIC = ['', 'index', 'login', 'register', 'app'];
    if (PUBLIC.includes(name)) return;

    // ---- THEME MAPPING ----
    const THEMES = {
        dashboard:    'theme-dashboard',
        pair:         'theme-pair',
        channel:      'theme-channel',
        live:         'theme-live',
        web:          'theme-web',
        settings:     'theme-settings',
        admin:        'theme-admin',
        'api-docs':   'theme-api',
        'api-dics':   'theme-api'
    };
    const themeClass = THEMES[name] || 'theme-dashboard';
    document.body.classList.add(themeClass);
    document.documentElement.style.background = '#000';

    // ---- USER ----
    let user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
    const isAdmin = user.isAdmin === true;
    const email   = user.email || user.name || 'user';
    const initial = (email.charAt(0) || 'U').toUpperCase();

    // ---- NAV ITEMS ----
    const NAV = [
        { sec: 'Main' },
        { id: 'dashboard', href: '/dashboard', icon: 'fa-gauge-high',      label: 'Dashboard' },
        { id: 'pair',      href: '/pair',      icon: 'fa-link',            label: 'Pair Device' },
        { id: 'channel',   href: '/channel',   icon: 'fa-tower-broadcast', label: 'Channel' },
        { id: 'web',       href: '/web',       icon: 'fa-comments',        label: 'Web Chat' },

        { sec: 'Account' },
        { id: 'live',      href: '/live',      icon: 'fa-satellite-dish',  label: 'Live Monitor' },
        { id: 'settings',  href: '/settings',  icon: 'fa-gear',            label: 'Settings' },

        { sec: 'Admin', admin: true },
        { id: 'admin',     href: '/admin',     icon: 'fa-shield-halved',   label: 'Admin Panel', admin: true },
        { id: 'api-docs',  href: '/api-docs',  icon: 'fa-code',            label: 'API Docs',    admin: true }
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
            || (item.id === 'api-docs' && (name === 'api-dics'));
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
                <div class="app-user">
                    <div class="app-user-avatar">${initial}</div>
                    <div class="app-user-info">
                        <div class="app-user-email">${escapeHtml(email)}</div>
                        <div class="app-user-role">${isAdmin ? 'Administrator' : 'User'}</div>
                    </div>
                </div>
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
        if (mount) {
            mount.outerHTML = sidebarHtml;
        } else {
            document.body.insertAdjacentHTML('afterbegin', sidebarHtml);
        }

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
        logout?.addEventListener('click', () => {
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