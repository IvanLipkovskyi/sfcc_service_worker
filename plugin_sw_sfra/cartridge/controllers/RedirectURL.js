'use strict';

var server = require('server');

server.extend(module.superModule);

/**
 * Handles the root-level service worker file and other redirects.
 *
 * Prepend:
 * - Intercepts requests for "service-worker.js" and serves it from the root URL.
 * - Applies caching and renders the appropriate ISML template.
 */
server.prepend('Start', function (req, res, next) {
    var URLRedirectMgr = require('dw/web/URLRedirectMgr');
    var origin = URLRedirectMgr.redirectOrigin;

    if (origin && origin.match(/service-worker\.js/)) {
        var serviceWorkerConfig = require('*/cartridge/scripts/helpers/swConfig').getInitConfig();

        if (serviceWorkerConfig.swEnabled) {
            res.cachePeriod = 24;
            res.cachePeriodUnit = 'hours';
        } else {
            res.cachePeriod = 0;
        }

        res.render('serviceWorker.js', {
            swConfig: serviceWorkerConfig
        });

        this.emit('route:Complete', req, res);
    } else {
        next();
    }
});

module.exports = server.exports();
