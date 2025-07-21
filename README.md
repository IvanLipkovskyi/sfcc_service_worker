# plugin_sw_sfra

## Description

`plugin_sw_sfra` is an SFRA‑compatible cartridge that adds Service Worker support for features such as page caching, offline access, and faster loading.

The plugin improves the user experience and lets shoppers interact with parts of the site even when they lose their Internet connection.

## Key Benefits

- Automatic Service Worker registration  
- Page caching for quick access  
- Offline mode with a dedicated fallback page  
- Flexible configuration via JavaScript and ISML templates  

## How to Integrate

1. **Copy the cartridge** into your project’s `cartridges/` folder.  
2. **Add it to the cartridge path** under *Sites → Site Preferences → Cartridges*, placing it **at the beginning** of the list:
plugin_sw_sfra:app_storefront_base
3. **Add static resources to static/default/**, especially offline.html, which is served when the connection is lost.
4. **Service‑worker hookup.** The service worker is attached in the RedirectUrl controller, so make sure you have properly extended the base version of that controller in your cartridge.
5. **Site ID & locale‑aware caching.** To generate a correct, per‑site/per‑locale cache, both the SiteID and the locale must be part of each cache key.
We achieve this by adding two custom headers in httpHeadersConf.js; they are sent with every request to the server.
You also need to ensure that AJAX calls include those headers.

***Injecting values into every page***
In all layout templates we expose the data as attributes on the root <html> element:

<html lang="${require('dw/util/Locale').getLocale(request.getLocale()).getLanguage()}"
      data-siteid="${require('dw/system/Site').getCurrent().getID()}"
      data-locale="${request.getLocale()}"
      data-swenabled="${dw.system.Site.getCurrent().getCustomPreferenceValue('EnableServiceWorker')}">
    
You can see this in checkout.isml, page.isml, and pdStorePage.isml.

***Adding the headers in client‑side scripts***

const locale = document.documentElement?.dataset?.locale || '';
const siteId = document.documentElement?.dataset?.siteid || '';

$.ajax({
    url: url,
    method: 'GET',
    headers: {
        'x-sf-cc-siteid': siteId,
        'x-sf-cc-requestlocale': locale,
        'x-requested-with': 'XMLHttpRequest'
    }
});

***data-swenabled*** carries the value from the Business Manager custom preference that globally turns the service worker on or off.

6. **swConfig.js**
The file swConfig.js contains the initial configuration of the service worker and the rules that determine how caching is handled.
Caching can be full‑page or partial. For example, you might keep just the header and footer in the cache while always fetching dynamic content fresh.


## License & Attribution

Released under the MIT License.You may copy, modify, merge, publish, distribute copies of the software.

Please keep a visible reference to the original author Ivan Lipkovskyi (e.g., in README or a code comment) – it is not a license requirement, but good open‑source etiquette.
