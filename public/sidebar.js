// public/sidebar.js
// Auto-injects the sidebar navigation into any page with <div id="appSidebarMount"></div>

(function () {
    const mount = document.getElementById('appSidebarMount');
    if (!mount) return;

    const path = window.location.pathname.replace('.html', '') || '/';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.email === 'ryanobanga243@gmail.com' || user.isAdmin === true;
    const email = user.email || 'User';
    const role = isAdmin ? 'Administrator' : 'User';

    // ============================================
    //   NAVIGATION ITEMS
    // ============================================
    const NAV_USER = [
        { name: 'Dashboard',   href: '/dashboard', icon: 'fa-home' },
        { name: 'Buy Credits', href: '/store',     icon: 'fa-shopping-cart' }, // <-- NEW
        { name: 'Pair Device', href: '/pair',      icon: 'fa-link' },
        { name: 'Channel',     href: '/channel',   icon: 'fa-bullhorn' },
        { name: 'Web Chat',    href: '/web',       icon: 'fa-comments' },
        { name: 'Profile',     href: '/profile',   icon: 'fa-user' },
        { name: 'Live Monitor',href: '/live',      icon: 'fa-satellite-dish' },
        { name: 'Settings',    href: '/settings',  icon: 'fa-gear' }
    ];

    const NAV_ADMIN = [
        { name: 'Admin Panel',    href: '/admin',            icon: 'fa-shield-halved' },
        { name: 'Sessions',       href: '/admin-sessions',   icon: 'fa-server' },
        { name: 'Takeover',       href: '/admin-takeover',   icon: 'fa-mask' },
        { name: 'Commands',       href: '/admin-commands',   icon: 'fa-terminal' },
        { name: 'Users',          href: '/admin-users',      icon: 'fa-users' },
        { name: 'Broadcast',      href: '/admin-broadcast',  icon: 'fa-tower-broadcast' },
        { name: 'Anti-Abuse',     href: '/admin-abuse',      icon: 'fa-triangle-exclamation' },
        { name: 'Analytics',      href: '/admin-analytics',  icon: 'fa-chart-line' },
        { name: 'Audit Log',      href: '/admin-audit',      icon: 'fa-clipboard-list' },
        { name: 'Backup',         href: '/admin-backup',     icon: 'fa-database' },
        { name: 'Payments',       href: '/admin-payments',   icon: 'fa-credit-card' },
        { name: 'AI Control',     href: '/admin-ai',         icon: 'fa-robot' },
        { name: 'API Docs',       href: '/api-docs',         icon: 'fa-code' }
    ];

    // ============================================
    //   BUILD HTML
    // ============================================
    let html = `
        <div class="sidebar-overlay" id="sbOverlay"></div>
        <aside class="sidebar" id="sb">
            <div class="sb-brand">
                <div class="sb-logo">🔑</div>
                <div>
                    <div class="sb-title">303-XMD</div>
                    <div class="sb-sub">THE LAST KEY</div>
                </div>
                <button class="sb-close" id="sbClose"><i class="fas fa-times"></i></button>
            </div>

            <div class="sb-section">
                <div class="sb-section-title">MAIN</div>
    `;

    NAV_USER.forEach(item => {
        const active = path === item.href ? 'active' : '';
        html += `
            <a href="${item.href}" class="sb-link ${active}">
                <i class="fas ${item.icon}"></i>
                <span>${item.name}</span>
            </a>
        `;
    });

    html += `</div>`;

    if (isAdmin) {
        html += `
            <div class="sb-section">
                <div class="sb-section-title">ADMIN</div>
        `;
        NAV_ADMIN.forEach(item => {
            const active = path === item.href ? 'active' : '';
            html += `
                <a href="${item.href}" class="sb-link ${active}">
                    <i class="fas ${item.icon}"></i>
                    <span>${item.name}</span>
                </a>
            `;
        });
        html += `</div>`;
    }

    html += `
            <div class="sb-user">
                <div class="sb-user-avatar">${email.charAt(0).toUpperCase()}</div>
                <div class="sb-user-info">
                    <div class="sb-user-email">${email}</div>
                    <div class="sb-user-role">${role}</div>
                </div>
                <button class="sb-logout" id="sbLogout" title="Logout">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </aside>
    `;

    mount.innerHTML = html;

    // ============================================
    //   MOBILE TOGGLE LOGIC
    // ============================================
    const sb = document.getElementById('sb');
    const overlay = document.getElementById('sbOverlay');
    const closeBtn = document.getElementById('sbClose');
    
    // Create the open button
    const openBtn = document.createElement('button');
    openBtn.className = 'sb-open';
    openBtn.id = 'sbOpen';
    openBtn.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.appendChild(openBtn);

    function openSidebar() {
        sb.classList.add('open');
        overlay.classList.add('show');
    }

    function closeSidebar() {
        sb.classList.remove('open');
        overlay.classList.remove('show');
    }

    openBtn.onclick = openSidebar;
    closeBtn.onclick = closeSidebar;
    overlay.onclick = closeSidebar;

    // Logout
    const logoutBtn = document.getElementById('sbLogout');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        };
    }

    // Apply Theme class based on page (if not already set on body)
    if (!document.body.className.includes('theme-')) {
        const pageName = path === '/' ? 'landing' : path.replace('/', '');
        document.body.classList.add(`theme-${pageName}`);
    }

})();