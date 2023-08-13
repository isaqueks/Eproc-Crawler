"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getCookieHeader(cookies) {
    const cookiesArray = [];
    for (const [key, value] of cookies) {
        cookiesArray.push(`${key}=${value}`);
    }
    return cookiesArray.join('; ');
}
exports.default = getCookieHeader;
