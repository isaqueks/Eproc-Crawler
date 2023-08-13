"use strict";
/**
 * Time.ts - Isaque K Schluter - 2023
 * iskschluter@gmail.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
class Time {
    static now() {
        return Date.now();
    }
    static fromSeconds(seconds) {
        return seconds * 1000;
    }
    static fromMinutes(minutes) {
        return this.fromSeconds(minutes * 60);
    }
    static fromHours(hours) {
        return this.fromMinutes(hours * 60);
    }
    static fromDays(days) {
        return this.fromHours(days * 24);
    }
    static addMonths(date, months) {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + months);
        return newDate;
    }
    static parseDDMMYYYY(date) {
        const [day, month, year] = date.split("/").map(Number);
        return new Date(year, month - 1, day);
    }
    static outputHHMM(date) {
        const [hh, mm] = date.toUTCString()
            .replace(/.*([0-9]{2})\:([0-9]{2})\:[0-9]{2} GMT/, '$1:$2')
            .split(':');
        return `${hh}:${mm}`;
    }
    static parseInputFormat(input) {
        const [year, month, day] = input.split('-');
        return Time.parseDDMMYYYY([day, month, year].join('/'));
    }
    static today() {
        const now = Date.now();
        return new Date(now - (now % Time.fromDays(1)));
    }
    static yesterday() {
        return new Date(+this.today() - this.fromDays(1));
    }
    static tomorrow() {
        return new Date(+this.today() + this.fromDays(1));
    }
    static getDaysTime(date) {
        const dateTs = +date;
        const time = Time.outputHHMM(date);
        const [timeHr, timeMin] = time.split(':');
        const timeTs = Time.fromHours(+timeHr) + Time.fromMinutes(+timeMin);
        const days = Math.round((dateTs - timeTs) / Time.fromDays(1));
        return [days, time];
    }
    static getDate(days, time) {
        const [timeHr, timeMin] = time.split(':');
        return new Date(Time.fromDays(days) + Time.fromHours(+timeHr) + Time.fromMinutes(+timeMin));
    }
}
exports.default = Time;
