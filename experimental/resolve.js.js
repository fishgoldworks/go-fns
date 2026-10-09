function resolve(value, params) {
    return typeof value === "function" ? value.apply(null, params) : value;
}

module.exports = resolve;