'use strict';

var superHttpHeadersConf = module.superModule || [];

module.exports = superHttpHeadersConf.concat([
    {
        id: 'X-SF-CC-RequestLocale',
        value: request.getLocale()
    },
    {
        id: 'X-SF-CC-SiteId',
        value: require('dw/system/Site').getCurrent().getID()
    }
]);
