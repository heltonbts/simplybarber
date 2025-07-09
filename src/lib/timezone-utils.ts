import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

export function getCurrentBrazilTime(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function createBrazilDateTime(
  dateString: string,
  timeString: string,
): Date {
  const wallClockDateTimeString = `${dateString}T${timeString}:00`;
  return fromZonedTime(wallClockDateTimeString, TIMEZONE);
}

export function formatBookingTime(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "HH:mm");
}

export function formatBookingDate(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "dd/MM/yyyy");
}

export function toBrazilTime(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

export function toUTC(date: Date): Date {
  return fromZonedTime(date, TIMEZONE);
}

export function isToday(date: Date): boolean {
  const todayString = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const targetDateString = formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
  return todayString === targetDateString;
}

export function isOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}
