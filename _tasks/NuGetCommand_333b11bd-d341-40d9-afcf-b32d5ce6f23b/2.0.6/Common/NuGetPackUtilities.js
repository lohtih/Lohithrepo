"use strict";
// Placed as a separate file for the purpose of unit testing
const utcTimezone = "utc";
const localTimezone = "local";
function getNowDateString(timezone) {
    if (timezone === utcTimezone) {
        return getUtcDateString(new Date());
    }
    if (timezone === localTimezone) {
        return getLocalDateString(new Date());
    }
    throw new Error('Internal error: Unknown timezone');
}
exports.getNowDateString = getNowDateString;
function getUtcDateString(now) {
    let year = "" + now.getUTCFullYear();
    let month = getTwoDigitNumberString(now.getUTCMonth() + 1); // Month is zero-based, so adding one
    let date = getTwoDigitNumberString(now.getUTCDate());
    let hours = getTwoDigitNumberString(now.getUTCHours());
    let minutes = getTwoDigitNumberString(now.getUTCMinutes());
    let seconds = getTwoDigitNumberString(now.getUTCSeconds());
    return `${year}${month}${date}-${hours}${minutes}${seconds}`;
}
exports.getUtcDateString = getUtcDateString;
function getLocalDateString(now) {
    let year = "" + now.getFullYear();
    let month = getTwoDigitNumberString(now.getMonth() + 1); // Month is zero-based, so adding one
    let date = getTwoDigitNumberString(now.getDate());
    let hours = getTwoDigitNumberString(now.getHours());
    let minutes = getTwoDigitNumberString(now.getMinutes());
    let seconds = getTwoDigitNumberString(now.getSeconds());
    return `${year}${month}${date}-${hours}${minutes}${seconds}`;
}
exports.getLocalDateString = getLocalDateString;
function getTwoDigitNumberString(number) {
    return number < 10 ? '0' + number : '' + number;
}
