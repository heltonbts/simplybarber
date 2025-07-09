import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const TIMEZONE = "America/Sao_Paulo";

export function getCurrentBrazilTime(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

// FIXED: More robust date creation that handles timezone conversion properly
export function createBrazilDateTime(
  dateString: string,
  timeString: string,
): Date {
  // Ensure we're working with the correct format
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

// FIXED: This function should ensure consistent UTC conversion
export function toUTC(date: Date): Date {
  // The date parameter should be treated as if it's already in Brazil timezone
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

// NEW: Helper function to create a date object from date string in Brazil timezone
export function createBrazilDateFromString(dateString: string): Date {
  // This ensures the date is interpreted as noon in Brazil timezone
  return fromZonedTime(`${dateString}T12:00:00`, TIMEZONE);
}

// NEW: Helper to get start and end of day in Brazil timezone, returned as UTC
export function getBrazilDayBounds(dateString: string): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const startOfDay = fromZonedTime(`${dateString}T00:00:00`, TIMEZONE);
  const endOfDay = fromZonedTime(`${dateString}T23:59:59`, TIMEZONE);

  return { startOfDay, endOfDay };
}
