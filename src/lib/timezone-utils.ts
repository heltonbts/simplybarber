// src/lib/timezone-utils.ts
import { format, parseISO, setHours, setMinutes } from "date-fns";

// Defina explicitamente o timezone do Brasil
const BRAZIL_TIMEZONE_OFFSET = -3; // GMT-3

// Função para converter UTC para horário do Brasil
export function toBrazilTime(date: Date): Date {
  const utcTime = date.getTime();
  const brazilTime = new Date(
    utcTime + BRAZIL_TIMEZONE_OFFSET * 60 * 60 * 1000,
  );
  return brazilTime;
}

// Função para converter horário do Brasil para UTC
export function toUTC(date: Date): Date {
  const brazilTime = date.getTime();
  const utcTime = new Date(
    brazilTime - BRAZIL_TIMEZONE_OFFSET * 60 * 60 * 1000,
  );
  return utcTime;
}

// Função para criar data com horário específico no timezone do Brasil
export function createBrazilDateTime(
  dateString: string,
  timeString: string,
): Date {
  const [hours, minutes] = timeString.split(":").map(Number);
  const date = parseISO(dateString);
  const brazilDate = setMinutes(setHours(date, hours), minutes);
  return toUTC(brazilDate); // Converter para UTC para salvar no banco
}

// Função para exibir horários (use essa no frontend)
export function formatBookingTime(date: Date): string {
  const brazilTime = toBrazilTime(date);
  return format(brazilTime, "HH:mm");
}

// Função para exibir datas (use essa no frontend)
export function formatBookingDate(date: Date): string {
  const brazilTime = toBrazilTime(date);
  return format(brazilTime, "dd/MM/yyyy");
}

// Função para obter data atual no timezone do Brasil
export function getCurrentBrazilTime(): Date {
  return toBrazilTime(new Date());
}

// Função para verificar se uma data é hoje no timezone do Brasil
export function isToday(date: Date): boolean {
  const today = getCurrentBrazilTime();
  const targetDate = toBrazilTime(date);

  return format(today, "yyyy-MM-dd") === format(targetDate, "yyyy-MM-dd");
}

export function isOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}
