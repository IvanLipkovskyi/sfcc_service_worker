/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./cartridges/app_storefront_base/cartridge/client/default/js/util.js":
/*!****************************************************************************!*\
  !*** ./cartridges/app_storefront_base/cartridge/client/default/js/util.js ***!
  \****************************************************************************/
/***/ (function(module) {

"use strict";
eval("\n\nmodule.exports = function (include) {\n    if (typeof include === 'function') {\n        include();\n    } else if (typeof include === 'object') {\n        Object.keys(include).forEach(function (key) {\n            if (typeof include[key] === 'function') {\n                include[key]();\n            }\n        });\n    }\n};\n\n\n//# sourceURL=webpack://sfra/./cartridges/app_storefront_base/cartridge/client/default/js/util.js?");

/***/ }),

/***/ "./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw-registration.js":
/*!**********************************************************************************!*\
  !*** ./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw-registration.js ***!
  \**********************************************************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

"use strict";
eval("\n\nvar processInclude = __webpack_require__(/*! base/util */ \"./cartridges/app_storefront_base/cartridge/client/default/js/util.js\");\n\n$(document).ready(function () {\n    processInclude(__webpack_require__(/*! ./sw/service-worker-registration */ \"./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw/service-worker-registration.js\"));\n});\n\n//# sourceURL=webpack://sfra/./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw-registration.js?");

/***/ }),

/***/ "./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw/service-worker-registration.js":
/*!*************************************************************************************************!*\
  !*** ./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw/service-worker-registration.js ***!
  \*************************************************************************************************/
/***/ (function(module) {

eval("/**\n * Resolves the correct service worker path based on the current environment.\n * In development, the root is \"/\", but on sandbox instances it typically includes a site-specific prefix like \"/s/SiteId/\".\n * @param {string} relativePath - Relative path to the service worker script.\n * @returns {string} - Full, environment-adjusted path.\n */\nfunction resolveServiceWorkerPath(relativePath) {\n    const sandboxMatch = window.location.pathname.match(/(\\/s\\/[^/]+)\\/?/);\n\n    return (sandboxMatch ? sandboxMatch[1] : '') + relativePath;\n}\n\n/**\n * Registers the service worker, if supported and applicable for the current URL.\n * Skips registration on system URLs like \"on/demandware.store\" to avoid interfering with backend routes.\n */\nfunction registerServiceWorker() {\n    if (!('serviceWorker' in navigator)) return;\n\n    let swInstance;\n    const swEnabled = document.documentElement?.dataset?.swenabled || 'false';\n    const isSystemUrl = window.location.pathname.indexOf('on/demandware.store') > -1;\n\n    // Skips registration on system URLs like \"on/demandware.store\" to avoid interfering with backend routes\n    if (isSystemUrl) return;\n\n    // Kill-switch: skip if disabled in config\n    if (swEnabled === \"false\") {\n        navigator.serviceWorker.getRegistrations().then(registration => {\n            registration.forEach(swInstance => swInstance.unregister());\n        });\n        return;\n    }\n   \n    // Register the service worker normally\n    navigator.serviceWorker.register(resolveServiceWorkerPath('/service-worker.js'))\n        .then((registration) => {\n            swInstance = registration;\n        }).catch((error) => {\n            if (!swInstance) return;\n\n            swInstance.unregister().then((wasUnregistered) => {\n                if (wasUnregistered) {\n                    swInstance = null;\n                }\n            });\n        });\n}\n\nmodule.exports = registerServiceWorker;\n\n\n//# sourceURL=webpack://sfra/./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw/service-worker-registration.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./cartridges/plugin_sw_sfra/cartridge/client/default/js/sw-registration.js");
/******/ 	
/******/ })()
;