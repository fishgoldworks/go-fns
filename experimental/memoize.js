var expectFunctioin = require("./util/expectFunction");
var Cache = require("./utils/Cache");

function memoize(fn, options) {
    expectFunctioin(fn);
    
    var keyResolver = options && options.keyResolver;
    var capacity = options && options.capacity;
    var maxAge = options && options.maxAge;
    var entries = options && options.entries;
    var readOnly = options && options.readOnly;

    if (options && options.keyResolver != null) {
        expectFunctioin(options.keyResolver);
    }

    var memoized = function () {
        var key = arguments[0];
        if (options.keyResolver) {
            key = options.keyResolver.apply(this, arguments);
        }
        

    };
    
    memoized.cache = ReadOnly(new Cache());
    
    return memoized;
}


module.exports = memoize;


var parsePropPath = memoize(parsePropPath);

parsePropPath.clearCache();