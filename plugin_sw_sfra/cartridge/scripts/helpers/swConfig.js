'use strict';

var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');

var serviceWorkerUtils = {};

/**
 * List of controllers that invalidate cached layout parts (e.g. header).
 * The cache is specific to both Site ID and locale.
 * If the cache is cleared for either one, it will invalidate all related
 * caches across all sites and locales.
 */
serviceWorkerUtils.layoutCacheInvalidationRoutes = [
    'Account-Login',
    'Account-SaveNewPassword',
    'Account-SubmitRegistration',
    'Login-Logout'
];

/**
 * List of controllers that invalidate cached AJAX responses (e.g. minicart).
 * The cache is specific to both Site ID and locale.
 * If the cache is cleared for either one, it will invalidate all related
 * caches across all sites and locales.
 */
serviceWorkerUtils.minicartCacheInvalidationRoutes = [
    'Cart-AddProduct',
    'Cart-Show',
    'Cart-UpdateQuantity',
    'Cart-RemoveProductLineItem',
    'Cart-AddCoupon',
    'Cart-RemoveCouponLineItem',
    'Cart-EditProductLineItem',
    'CSRF-AjaxFail',
    'CSRF-Fail',
    'CheckoutServices-PlaceOrder',
    'Order-Confirm',
    'COPlaceOrder-Submit',
    'Account-Login',
    'Login-Logout'
];

/**
 * List of controllers that invalidate cached wishlist AJAX responses.
 * The cache is specific to both Site ID and locale.
 * If the cache is cleared for either one, it will invalidate all related
 * caches across all sites and locales.
 */
serviceWorkerUtils.wishlistCacheInvalidationRoutes = [
    'Wishlist-AddProduct',
    'Wishlist-RemoveProduct',
    'Wishlist-EditProductListItem'
];

/**
 * Converts controller-action strings to full relative URLs.
 * @param {Array} actions - List of controller-action routes.
 * @returns {Array} List of formatted relative URLs.
 */
serviceWorkerUtils.buildRelativeUrls = function (actions) {
    return actions.map(function (action) {
        return URLUtils.url(action).toString().replace(/(Sites-[\w\-_]+-Site\/[\w]{2,7}\/)/, '');
    });
};

/**
 * Builds the configuration object passed to the Service Worker during initialization.
 * Includes:
 * - URLs of offline fallback and dynamic parts (e.g. header, footer)
 * - Rules for invalidating cached parts
 * - Metadata like site ID, locale, and cache version
 *
 * IMPORTANT: All placeholders must begin with `$sw` to be processed correctly by the streamHelper logic.
 * @returns {object} Initialization config for the Service Worker
 */

serviceWorkerUtils.getInitConfig = function () {
    return {
        /* Offline fallback page cached on the user's first visit */
        offlineUrl: URLUtils.staticURL('offline.html').toString(),

        /* Document sections that are cached and not reloaded with each page view */
        cachedParts: [
            {
                url: URLUtils.url('Page-IncludeHeaderMenu', 'sw', 'true').toString(),
                placeholder: '$swheader$',
                skipParameter: 'sw_skipheader',
                cacheSuffix: 'header',
                cacheCleanTriggerUrls: serviceWorkerUtils.buildRelativeUrls(serviceWorkerUtils.layoutCacheInvalidationRoutes)
            },
            {
                url: URLUtils.url('Page-IncludeFooter', 'sw', 'true').toString(),
                placeholder: '$swfooter$',
                skipParameter: 'sw_skipfooter',
                cacheSuffix: 'footer',
                cacheCleanTriggerUrls: serviceWorkerUtils.buildRelativeUrls(serviceWorkerUtils.layoutCacheInvalidationRoutes)
            }
        ],
        
        /* Full backend requests stored in cache */
        cachedUrls: [
            {
                url: URLUtils.url('Cart-MiniCartShow').toString(),
                cacheSuffix: 'MiniCartShow',
                cacheCleanTriggerUrls: serviceWorkerUtils.buildRelativeUrls(serviceWorkerUtils.minicartCacheInvalidationRoutes)
            },
            {
                url: URLUtils.url('Wishlist-Show').toString(),
                cacheSuffix: 'WishlistShow',
                cacheCleanTriggerUrls: serviceWorkerUtils.buildRelativeUrls(serviceWorkerUtils.wishlistCacheInvalidationRoutes)
            }
        ],

        /* Metadata used by the service worker to select the correct localized cache */
        urlSiteId: Site.getCurrent().getID(),
        urlLocale: request.getLocale(),

        /* Extract cache version from static URL
           Ex Library-Sites-library-shared/default/dw4ae791b3/ dw4ae791b3 would be cache version
        */
        cacheVersion: URLUtils.staticURL('').toString().match(/[^/]*$/)[0],

        /* Server worker enabled/disabled via Business Manage */
        swEnabled: Site.getCurrent().getCustomPreferenceValue('EnableServiceWorker') || false
    };
};

module.exports = serviceWorkerUtils;