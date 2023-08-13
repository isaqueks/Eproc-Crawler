/**
 * Time.ts - Isaque K Schluter - 2023
 * iskschluter@gmail.com
 */
export default class Time {
    static now(): number;
    static fromSeconds(seconds: number): number;
    static fromMinutes(minutes: number): number;
    static fromHours(hours: number): number;
    static fromDays(days: number): number;
    static addMonths(date: Date, months: number): Date;
    static parseDDMMYYYY(date: string): Date;
    static outputHHMM(date: Date): string;
    static parseInputFormat(input: string): Date;
    static today(): Date;
    static yesterday(): Date;
    static tomorrow(): Date;
    static getDaysTime(date: Date): (string | number)[];
    static getDate(days: number, time: string): Date;
}
