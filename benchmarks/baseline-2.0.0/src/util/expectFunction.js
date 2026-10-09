"use strict";

function expectFunction(arg) {
    if (typeof arg !== "function") {
        // Do not stringify untrusted values while constructing a validation error.
        throw new TypeError("Expected a function.");
    }
    return arg;
}

module.exports = expectFunction;
