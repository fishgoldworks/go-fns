"use strict";

/** Validate and copy a sequence of functions, ignoring null and undefined. */
function normalizeFunctions(args) {
    var functions = [];
    for (var i = 0; i < args.length; i++) {
        var fn = args[i];
        if (fn === null || fn === undefined) {
            continue;
        }
        if (typeof fn !== "function") {
            throw new TypeError("Expected a function, null or undefined.");
        }
        functions.push(fn);
    }
    return functions;
}

module.exports = normalizeFunctions;
