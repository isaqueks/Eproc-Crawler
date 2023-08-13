/**
 * Time.ts - Isaque K Schluter - 2023
 * iskschluter@gmail.com
 */

export default class Time {

    public static now(): number {
        return Date.now();
    }

    public static fromSeconds(seconds: number): number {
        return seconds * 1000;
    }

    public static fromMinutes(minutes: number): number {
        return this.fromSeconds(minutes * 60);
    }

    public static fromHours(hours: number): number {
        return this.fromMinutes(hours * 60);
    }

    public static fromDays(days: number): number {
        return this.fromHours(days * 24);
    }

    public static addMonths(date: Date, months: number): Date {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + months);
        return newDate;
    }

    public static parseDDMMYYYY(date: string): Date {
        const [day, month, year] = date.split("/").map(Number);
        return new Date(year, month - 1, day);
    }

    public static outputHHMM(date: Date): string {
        const [ hh, mm ] = date.toUTCString()
        .replace(/.*([0-9]{2})\:([0-9]{2})\:[0-9]{2} GMT/, '$1:$2')
        .split(':');
        return `${hh}:${mm}`;
    }


    public static parseInputFormat(input: string): Date {
        const [ year, month, day ] = input.split('-');
        return Time.parseDDMMYYYY([ day, month, year ].join('/'));
    }

    public static today(): Date {
        const now = Date.now();
        return new Date(now - (now % Time.fromDays(1)))
    }

    public static yesterday(): Date {
        return new Date(+this.today() - this.fromDays(1));
    }

    public static tomorrow(): Date {
        return new Date(+this.today() + this.fromDays(1));
    }

    public static getDaysTime(date: Date) {
        const dateTs = +date;
        const time: string = Time.outputHHMM(date);
        const [ timeHr, timeMin ] = time.split(':');
    
        const timeTs = Time.fromHours(+timeHr) + Time.fromMinutes(+timeMin);
    
        const days: number = Math.round((dateTs - timeTs) / Time.fromDays(1));
    
        return [ days, time ];
    }
    
    public static getDate (days: number, time: string) {
        const [ timeHr, timeMin ] = time.split(':');
    
        return new Date(
            Time.fromDays(days) + Time.fromHours(+timeHr) + Time.fromMinutes(+timeMin)
        );
    }

}