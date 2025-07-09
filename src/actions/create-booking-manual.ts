import { db } from "@/lib/prisma";
import { TIMEZONE } from "@/lib/timezone-utils";
import { fromZonedTime } from "date-fns-tz";

export async function createManualBookingAction(
  // 1. Defina a nova função para aceitar os 9 argumentos
  barbershopId: string,
  barberId: string,
  serviceId: string,
  selectedDate: string,
  selectedTime: string,
  clientName: string,
  clientPhone?: string,
  notes?: string,
  userId?: string | null,
) {
  // 2. A lógica interna é muito parecida com a anterior
  const bookingDateUTC = fromZonedTime(
    `${selectedDate}T${selectedTime}:00`,
    TIMEZONE,
  );

  const booking = await db.booking.create({
    data: {
      barbershopId,
      barberId,
      serviceId,
      date: bookingDateUTC,
      clientName, // <-- Salva o nome do cliente
      clientPhone, // <-- Salva o telefone
      notes, // <-- Salva as observações
      userId, // <-- Salva o ID do usuário, se houver
    },
  });

  return { success: true, booking };
}
