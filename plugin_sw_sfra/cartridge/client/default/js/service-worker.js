/**
 * Main service worker script.
 *
 * This service worker handles:
 * - Caching AJAX responses and page fragments defined in configuration.
 * - Showing an offline page when the network is unavailable.
 * - Caching static assets such as images, fonts, JS, and CSS.
 * - Cache cleanup using URL triggers.
 * - Fast updates using skipWaiting and clients.claim.
 * - Basic auth fallback support for browser issues (e.g., Chrome bug).
 */

import { createStream, X_SF_CC_SITEID, X_SF_CC_REQUESTLOCALE } from './sw/helpers/streamHelper';

// These values are injected at build time
self.buildSuitePreparedData = {
    codeVersion: `Build-${new Date().getTime()}` 
};
// Generate cache name as code version + BE cache version. We need it to properly invalidate it on each build or Demandware cache reset.
const CACHE_ID = self.buildSuitePreparedData.codeVersion + '_' + self.serverPreparedData.cacheVersion;
const OFFLINE_URL = self.serverPreparedData.offlineUrl;

/**
 * Create a lookup table for URLs that trigger cache invalidation.
 * @returns {Object} Map of URL to cache suffix list.
 */
function generateCacheInvalidationMap() {
    const map = {};
    for (const part of self.serverPreparedData.cachedParts) {
        for (const url of part.cacheCleanTriggerUrls) {
            map[url] = map[url] || [];
            map[url].push(part.cacheSuffix);
        }
    }
    for (const urlConfig of self.serverPreparedData.cachedUrls) {
        for (const url of urlConfig.cacheCleanTriggerUrls) {
            map[url] = map[url] || [];
            map[url].push(urlConfig.cacheSuffix);
        }
    }
    return map;
}

self.cacheCleanUrls = generateCacheInvalidationMap();

/**
 * Determines whether the given URL points to a resource located in the Library or Static folders.
 * This helps identify which resources should be cached or intercepted by the service worker.
 * @param {string} url - The resource URL to evaluate.
 * @returns {boolean} - True if the URL belongs to Library or Static folders; otherwise, false.
 */
function isStaticResource(url) {
    return /\/demandware.static\//.test(url) && !/\/demandware.static\/-\/Sites-[^/]+/.test(url);
}

/**
 * Verifies whether the resource has an allowed file extension.
 * This check is necessary because some requests might not include a valid "destination" attribute.
 * @param {string} url - The resource URL to check.
 * @returns {boolean} - True if the URL matches one of the allowed file extensions; otherwise, false.
 */
function isAllowedExtension(url) {
    return /.*\.(js|css)/.test(url);
}

/**
 * Determines whether a given request should be cached based on its type.
 * Checks if the request corresponds to a cacheable file type (e.g., scripts, styles, fonts, images).
 * @param {Request} request - The FetchEvent request object.
 * @returns {boolean} - True if the file is eligible for caching; otherwise, false.
 */
function isCacheableStatic(request) {
    var a = isStaticResource(request.url);
    if (isStaticResource(request.url)) {
        var b =
            ['image', 'script', 'style', 'font'].indexOf(request.destination) !== -1 ||
            isAllowedExtension(request.url);

        return b;
    }
    return false;
}

/**
 * Add skip parameters to fetch request to exclude cached page parts.
 * @param {Request} originalRequest 
 * @returns {Request} New request with skip parameters.
 */
async function addSkipParamsToRequest(originalRequest) {
    const url = new URL(originalRequest.url);
    for (const part of self.serverPreparedData.cachedParts || []) {
        if (part.skipParameter) {
            url.searchParams.append(part.skipParameter, 'true');
        }
    }
    const init = {
        cache: originalRequest.cache,
        credentials: originalRequest.credentials,
        headers: originalRequest.headers,
        method: originalRequest.method,
        referrer: originalRequest.referrer,
        redirect: 'manual'
    };
    const buffer = await originalRequest.arrayBuffer();
    if (buffer && buffer.byteLength > 0) {
        init.body = buffer;
    }
    return new Request(url, init);
}

/**
 * Find cache config for AJAX request.
 * @param {FetchEvent} event 
 * @returns {Object|boolean}
 */
function getAjaxCacheConfig(event) {

    var vals= [];

    for (let [key, value] of event.request.headers.entries()) {
        vals.push(`${key}: ${value}`);
    }
    const siteId = event.request.headers.get(X_SF_CC_SITEID);
    const locale = event.request.headers.get(X_SF_CC_REQUESTLOCALE);
    if (!siteId || !locale) return false;

    return self.serverPreparedData.cachedUrls.find(cfg => {
        let expectedUrl = cfg.url
            .replace(`-${self.serverPreparedData.urlSiteId}-`, `-${siteId}-`)
            .replace(`/${self.serverPreparedData.urlLocale}/`, `/${locale}/`);

        return event.request.url.indexOf(expectedUrl) !== -1;
    });
}

/**
 * Returns an HTML/JavaScript response that unregisters all active service workers and reloads the page.
 * This workaround addresses a Chrome bug that prevents the Basic Authentication prompt from displaying
 * when a request is intercepted by a service worker.
 * See: https://bugs.chromium.org/p/chromium/issues/detail?id=1055253
 * @returns {Response} - An HTML response with a script to unregister service workers and reload the page.
 */
function getBasicAuthFallbackResponse() {
    return new Response(`
        <html><head><script>
            navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))).then(() => {
                window.location.reload();
            });
        </script></head><body></body></html>
    `, {
        headers: new Headers({ 'Content-Type': 'text/html' })
    });
}

function isSameOrigin(url) {
  return new URL(url, self.location).origin === self.location.origin;
}

/**
 * Asynchronously deletes all outdated caches within the current service worker scope.
 * This ensures only the active cache version is kept and used by the service worker.
 * @returns {Promise} - A promise that resolves once all old cache entries have been removed.
 */
async function clearOldCaches() {
    const names = await caches.keys();
    return Promise.all(names.filter(name => name !== CACHE_ID).map(n => caches.delete(n)));
}

/**
 * Disables the Navigation Preload feature for the service worker.
 * This is necessary because preloading fetches the original URL before we can append custom parameters,
 * which can result in unnecessary or duplicate network requests.
 * For reference: https://developers.google.com/web/updates/2017/02/navigation-preload
 * @returns {void}
 */
async function disableNavigationPreload() {
    if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.disable();
    }
}

/**
 * Caches the offline fallback page during service worker installation.
 * The `{ cache: 'reload' }` option ensures the page is fetched directly from the network,
 * bypassing any existing HTTP cache.
 * @returns {void}
 */
async function precacheOfflinePage() {
    const cache = await caches.open(CACHE_ID);
    await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
}

/**
 * Compares the current request URL (from the fetch event) against a list of predefined cache-cleaning trigger URLs.
 * Each cache key follows the pattern: SiteId.Locale.Suffix. When a match is found, the corresponding cache entries are cleared
 * for all Site IDs and locales.
 * @param {FetchEvent} fetchEvent - The fetch event containing the request to check.
 * @returns {object} - An object representing key-value pairs used for cache cleanup.
 */
async function cleanTriggeredCache(fetchEvent) {    
    const shortUrl = fetchEvent.request.url.replace(/(Sites-[\w\-_]+-Site\/[\w]{2,7}\/)/, '');
    const trigger = Object.keys(self.cacheCleanUrls).find(u => shortUrl.indexOf(u) !== -1);
    const suffixes = self.cacheCleanUrls[trigger] || [];
    const cache = await caches.open(CACHE_ID);
    const keys = await cache.keys();

    const toDelete = keys.filter(entry => suffixes.some(s => entry.url.indexOf('.' + s) !== -1));
    await Promise.all(toDelete.map(k => cache.delete(k)));
}

/**
 * Handles all navigation requests by constructing a new Response object that combines
 * the network response with cached partial content (e.g., header/footer).
 * Site ID and locale are extracted from response headers and used to determine cache keys.
 * The required cache parts and placeholders are defined in `serviceWorkerConfig.js` and inserted during runtime.
 * If the network is unavailable, the pre-cached offline page is returned instead.
 * Note: A `fetch()` response with a 4xx or 5xx status will not trigger a `catch()` block.
 * See more:
 * [Offline fallback](https://web.dev/offline-fallback-page/)
 * [Offline page example](https://serviceworke.rs/offline-fallback_service-worker_doc.html)
 * @param {FetchEvent} fetchEvent - The fetch event for a navigation request.
 * @returns {Response} - A complete HTML response from either the network or offline cache.
 */
async function respondToNavigation(fetchEvent) {    
    try {
        await cleanTriggeredCache(fetchEvent);
        const modifiedRequest = await addSkipParamsToRequest(fetchEvent.request);
        let networkResponse = await fetch(modifiedRequest);

        if (networkResponse.status === 401) return getBasicAuthFallbackResponse();
        if ([301, 302].indexOf(networkResponse.status) !== -1 || networkResponse.type === 'opaqueredirect') return networkResponse;

        return createStream(networkResponse, self.serverPreparedData.cachedParts, CACHE_ID);
    } catch (err) {
        const cache = await caches.open(CACHE_ID);
        return await cache.match(OFFLINE_URL);
    }
}

/**
 * Handles "same-origin" fetch requests by returning either a cached response or fetching from the network.
 * If the request matches a configured cache rule, the service worker attempts to retrieve it from the cache.
 * If not found, it fetches the response from the network, caches it for future use, and then returns it.
 * @param {FetchEvent} fetchEvent - The fetch event for an AJAX or API request.
 * @param {object} config - Configuration object specifying how to cache the request.
 * @returns {Response} - The response retrieved from the cache or the network.
 */
async function respondToAjax(fetchEvent, config) {
    if (config) {
        const cache = await caches.open(CACHE_ID);
        const siteId = fetchEvent.request.headers.get(X_SF_CC_SITEID);
        const locale = fetchEvent.request.headers.get(X_SF_CC_REQUESTLOCALE);
        const key = siteId + '.' + locale + '.' + config.cacheSuffix;
        let cached = await cache.match(key);

        if (cached) return cached;

        cached = await fetch(fetchEvent.request);

        if (cached && cached.ok) {
            fetchEvent.waitUntil(cache.put(key, cached.clone()));
        }
        
        return cached;
    }

    return fetch(fetchEvent.request);
}

/**
 * Handles fetch requests for static resources (e.g., images, scripts, styles).
 * Tries to return the resource from cache first. If not available, fetches it from the network,
 * stores it in the cache for future use, and returns the network response.
 * For more on caching strategies, see:
 * [Caching files](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker),
 * [Network or cache](https://serviceworke.rs/strategy-network-or-cache.html)
 * @param {Request} request - The fetch event's request object for a static resource.
 * @returns {Response} - Cached or network response for the requested resource.
 */
async function respondToStatic(request) {
    const cache = await caches.open(CACHE_ID);
    const cached = await cache.match(request);
    if (cached) return cached;
    const network = await fetch(request);

    if (network && network.ok) {
        cache.put(request, network.clone());
    }
    return network;
}

self.addEventListener('install', (event) => {
    // Kill-switch moved here — works reliably
    if (self.serverPreparedData?.swEnabled === false) {
        event.waitUntil(
            (async () => {
                // Clear all caches
                clearOldCaches()

                // Unregister SW
                await self.registration.unregister();

                // Reload all tabs
                const clients = await self.clients.matchAll();
                for (const client of clients) {
                    client.navigate(client.url);
                }
            })()
        );
        return; // Stop further activation
    } else {
        event.waitUntil(precacheOfflinePage());
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    const sendPostMessage = messageStr => self.clients.matchAll()
        .then(clientList => clientList.forEach(client =>
            client.postMessage({ message: messageStr })));

    event.waitUntil(sendPostMessage(CACHE_ID));

    event.waitUntil(disableNavigationPreload());
    clearOldCaches();
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const ajaxConfig = getAjaxCacheConfig(event);

    if (isSameOrigin(request.url) && ajaxConfig) {
        event.respondWith(respondToAjax(event, ajaxConfig));
    } else if (request.mode === 'same-origin') {
        event.waitUntil(cleanTriggeredCache(event));
    } else if (request.mode === 'navigate') {
        event.respondWith(respondToNavigation(event));
    } else if (isCacheableStatic(request)) {
        event.respondWith(respondToStatic(request));
    }
});
