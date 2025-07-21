'use strict';

var server = require('server');
var cache = require('*/cartridge/scripts/middleware/cache');

server.extend(module.superModule);


/**
 * @name Page-IncludeHeaderMenu
 * @function
 * @description Renders header menu
 * @memberof Page
 * @param {middleware} - server.middleware.get - allow only GET requests
 * @param {middleware} - cache.middleware.https - allow only HTTPS requests
 * @param {middleware} - cache.applyDefaultCache - applies default cache configuration
 * @param {category} - non-sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 * Replaced because:
 * - to support standalone GET call to this endpoint (caching via service worked)
 */

server.replace('IncludeHeaderMenu',
    server.middleware.get,
    server.middleware.https,
    cache.applyDefaultCache,
    function (req, res, next) {
        var catalogMgr = require('dw/catalog/CatalogMgr');
        var Categories = require('*/cartridge/models/categories');
        var siteRootCategory = catalogMgr.getSiteCatalog().getRoot();

        var topLevelCategories = siteRootCategory.hasOnlineSubCategories()
            ? siteRootCategory.getOnlineSubCategories() : null;

        res.render('/components/header/menu', new Categories(topLevelCategories));

        next();
    });

/**
 * @name Page-IncludeFooter
 * @function
 * @description Renders page footer
 * @param {middleware} - cache.applyDefaultCache - applies default cache configuration
 */
server.get(
    'IncludeFooter',
    cache.applyDefaultCache,
    function (req, res, next) {
        res.render('/components/footer/pageFooter');

        next();
    }
);

module.exports = server.exports();
