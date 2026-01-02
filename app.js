(() => {
    const toggle = document.getElementById('themeToggle');
    const logoutButton = document.getElementById('logoutButton');
    if (!toggle) return;

    const root = document.documentElement;
    const label = toggle.querySelector('.ui-toggle-label');
    const icon = toggle.querySelector('.ui-toggle-icon');

    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored || (prefersDark ? 'dark' : 'light');

    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        toggle.setAttribute('aria-pressed', String(isDark));
        if (label) label.textContent = isDark ? 'Modo claro' : 'Modo escuro';
        if (icon) icon.textContent = isDark ? 'Sol' : 'Lua';
    };

    applyTheme(initial);

    toggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await fetch('/api/logout', { method: 'POST' });
            } finally {
                window.location.href = '/login';
            }
        });
    }
})();
