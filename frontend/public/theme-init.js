// Applies the saved theme before Angular boots to avoid a flash of the wrong
// color scheme. Kept as an external file (not inline in index.html) so the
// Content-Security-Policy can stay at script-src 'self'.
(function () {
    try {
        var mode = localStorage.getItem('theme-mode') || 'system';
        var isDark =
            mode === 'dark' ||
            (mode === 'system' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch (e) {}
})();
