(() => {
    const configUrl = '/api/config/sentry';
    const sentryCdnUrl = 'https://browser.sentry-cdn.com/7.60.0/bundle.min.js';

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    const initSentry = (config) => {
        if (!config || !config.dsn || !window.Sentry) return;
        const options = {
            dsn: config.dsn,
            environment: config.environment || 'development'
        };
        if (config.release) {
            options.release = config.release;
        }
        const sampleRate = Number(config.tracesSampleRate);
        if (!Number.isNaN(sampleRate) && sampleRate > 0) {
            options.tracesSampleRate = sampleRate;
        }
        window.Sentry.init(options);
        window.Sentry.setTag('app', 'frontend');
    };

    fetch(configUrl, { credentials: 'same-origin' })
        .then((response) => (response.ok ? response.json() : null))
        .then((config) => {
            if (!config || !config.dsn) return;
            return loadScript(sentryCdnUrl).then(() => initSentry(config));
        })
        .catch(() => {
            // Silently ignore configuration errors.
        });
})();
