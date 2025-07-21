/**
 * Resolves the correct service worker path based on the current environment.
 * In development, the root is "/", but on sandbox instances it typically includes a site-specific prefix like "/s/SiteId/".
 * @param {string} relativePath - Relative path to the service worker script.
 * @returns {string} - Full, environment-adjusted path.
 */
function resolveServiceWorkerPath(relativePath) {
    const sandboxMatch = window.location.pathname.match(/(\/s\/[^/]+)\/?/);

    return (sandboxMatch ? sandboxMatch[1] : '') + relativePath;
}

/**
 * Registers the service worker, if supported and applicable for the current URL.
 * Skips registration on system URLs like "on/demandware.store" to avoid interfering with backend routes.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    let swInstance;
    const swEnabled = document.documentElement?.dataset?.swenabled || "false";
    const isSystemUrl = window.location.pathname.indexOf('on/demandware.store') > -1;

    // Skips registration on system URLs like "on/demandware.store" to avoid interfering with backend routes
    if (isSystemUrl) return;

    // Kill-switch: skip if disabled in config
    if (swEnabled === "false") {
        navigator.serviceWorker.getRegistrations().then(registration => {
            registration.forEach(swInstance => swInstance.unregister());
        });
        return;
    }
   
    // Register the service worker normally
    navigator.serviceWorker.register(resolveServiceWorkerPath('/service-worker.js'))
        .then((registration) => {
            swInstance = registration;
        }).catch((error) => {
            if (!swInstance) return;

            swInstance.unregister().then((wasUnregistered) => {
                if (wasUnregistered) {
                    swInstance = null;
                }
            });
        });
}

module.exports = registerServiceWorker;
