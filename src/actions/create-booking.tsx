"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  getDay,
  setHours,
  setMinutes,
  addMinutes,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Booking, BarbershopService, User } from "../../generated/prisma";
import { unstable_noStore as noStore } from "next/cache";

export interface CreateBookingInput {
  serviceId: string;
  date: Date;
  barbershopId: string;
  barberId: string;
  clientName?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
}

export interface CreateBookingResult {
  success: boolean;
  booking?: Booking;
  error?: string;
  newAvailableSlots?: string[];
}

export type BarberWithUser = {
  id: string;
  user: User;
};

export type BookingDetails = Booking & {
  service: BarbershopService;
  barber: BarberWithUser;
  user?: User | null;
  formattedDate?: string;
};

const timeZone = "America/Sao_Paulo";

export async function getBookingsByBarbershop(
  barbershopId: string,
): Promise<BookingDetails[]> {
  if (!barbershopId) return [];

  const bookings = await db.booking.findMany({
    where: { barbershopId },
    include: {
      service: true,
      barber: { include: { user: true } },
      user: true,
    },
    orderBy: { date: "desc" },
  });

  const bookingsWithFormattedDate = bookings.map((booking) => {
    const formattedDate = formatInTimeZone(
      booking.date,
      timeZone,
      "dd/MM/yyyy 'às' HH:mm",
      { locale: ptBR },
    );

    return {
      ...booking,
      formattedDate: formattedDate,
    };
  });

  return bookingsWithFormattedDate;
}

export interface UpdateBookingInput extends CreateBookingInput {
  bookingId: string;
}

export async function updateBooking(payload: UpdateBookingInput) {
  const session = await getServerSession(authOptions);
  const { bookingId, ...data } = payload;

  if (!session?.user?.id) {
    throw new Error("Acesso não autorizado.");
  }
  if (!bookingId) {
    throw new Error("ID do agendamento é obrigatório para atualização.");
  }

  const bookingToUpdate = await db.booking.findUnique({
    where: { id: bookingId },
    select: { barbershop: { select: { ownerId: true } } },
  });

  if (bookingToUpdate?.barbershop.ownerId !== session.user.id) {
    throw new Error("Você não tem permissão para editar este agendamento.");
  }

  await db.booking.update({
    where: { id: bookingId },
    data: {
      serviceId: data.serviceId,
      date: data.date,
      barberId: data.barberId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      notes: data.notes,
    },
  });

  revalidatePath("/dashboard/agendamentos");
}

export async function getAvailableTimeSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  noStore();

  return await db.$transaction(async (tx) => {
    const service = await tx.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });
    if (!service) return [];

    const zonedDate = toZonedTime(selectedDate, timeZone);
    const weekDay = getDay(zonedDate);

    const barbershopWorkingHour = await tx.barbershopWorkingHour.findUnique({
      where: { barbershopId_weekDay: { barbershopId, weekDay } },
    });
    if (!barbershopWorkingHour?.isOpen) return [];

    // --- LOGS DE DEPURAÇÃO ADICIONADOS AQUI ---
    const start = startOfDay(zonedDate);
    const end = endOfDay(zonedDate);

    console.log(
      `[PROVE_IT_DEBUG] Buscando agendamentos no banco entre: ${start.toISOString()} e ${end.toISOString()}`,
    );

    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: { gte: start, lt: end },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });

    console.log(
      `[PROVE_IT_DEBUG] O BANCO DE DADOS RETORNOU: ${existingBookings.length} agendamentos.`,
    );

    if (existingBookings.length > 0) {
      console.log(
        "[PROVE_IT_DEBUG] Detalhes dos agendamentos encontrados:",
        existingBookings.map((b) => ({
          date: b.date.toISOString(),
          duration: b.service.durationInMinutes,
        })),
      );
    }
    // --- FIM DOS LOGS ---

    const [openHour, openMinute] = barbershopWorkingHour.openTime
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
      .split(":")
      .map(Number);

    const startOfWorkDay = setMinutes(
      setHours(zonedDate, openHour),
      openMinute,
    );
    const endOfWorkDay = setMinutes(
      setHours(zonedDate, closeHour),
      closeMinute,
    );
    const nowInZone = toZonedTime(new Date(), timeZone);

    const potentialSlots: Date[] = [];
    let currentTime = startOfWorkDay;
    while (isBefore(currentTime, endOfWorkDay)) {
      potentialSlots.push(currentTime);
      currentTime = addMinutes(currentTime, 15);
    }

    const availableSlots = potentialSlots.filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, service.durationInMinutes);

      if (isAfter(slotEnd, endOfWorkDay)) return false;
      if (isBefore(slotStart, nowInZone)) return false;

      const lunchStart = barbershopWorkingHour.lunchStart
        ? setMinutes(
            setHours(
              zonedDate,
              Number(barbershopWorkingHour.lunchStart.split(":")[0]),
            ),
            Number(barbershopWorkingHour.lunchStart.split(":")[1]),
          )
        : null;
      const lunchEnd = barbershopWorkingHour.lunchEnd
        ? setMinutes(
            setHours(
              zonedDate,
              Number(barbershopWorkingHour.lunchEnd.split(":")[0]),
            ),
            Number(barbershopWorkingHour.lunchEnd.split(":")[1]),
          )
        : null;
      if (
        lunchStart &&
        lunchEnd &&
        isBefore(slotStart, lunchEnd) &&
        isAfter(slotEnd, lunchStart)
      )
        return false;

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = toZonedTime(booking.date, timeZone);
        const bookingEnd = addMinutes(
          bookingStart,
          booking.service.durationInMinutes,
        );
        return (
          isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart)
        );
      });

      if (hasConflict) return false;
      return true;
    });

    return availableSlots.map((date) =>
      formatInTimeZone(date, timeZone, "HH:mm"),
    );
  });
}

export const createBooking = async ({
  serviceId,
  date,
  barbershopId,
  barberId,
  clientName = null,
  clientPhone = null,
  notes = null,
}: CreateBookingInput): Promise<CreateBookingResult> => {
  noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Acesso não autorizado." };
  }

  const bookingDate = new Date(date);
  if (isNaN(bookingDate.getTime())) {
    return { success: false, error: "Data inválida." };
  }

  try {
    // A transação garante que todas as operações sejam atômicas e consistentes
    const booking = await db.$transaction(async (tx) => {
      // 1. Buscamos a duração do serviço DENTRO da transação
      const service = await tx.barbershopService.findUnique({
        where: { id: serviceId },
        select: { durationInMinutes: true },
      });

      if (!service) {
        throw new Error("Serviço não encontrado.");
      }

      // 2. Fazemos uma "verificação dupla" (double-check) DENTRO da transação
      // Esta leitura é garantida de ser a mais atualizada possível
      const newBookingStart = toZonedTime(bookingDate, timeZone);
      const newBookingEnd = addMinutes(
        newBookingStart,
        service.durationInMinutes,
      );

      const conflictingBookings = await tx.booking.findMany({
        where: {
          barberId,
          date: {
            // Busca por qualquer agendamento que termine depois do nosso início
            // E comece antes do nosso fim
            gte: addMinutes(newBookingStart, -service.durationInMinutes + 1),
            lt: addMinutes(newBookingEnd, service.durationInMinutes - 1),
          },
        },
        include: { service: { select: { durationInMinutes: true } } },
      });

      const hasConflict = conflictingBookings.some((existingBooking) => {
        const existingStart = toZonedTime(existingBooking.date, timeZone);
        const existingEnd = addMinutes(
          existingStart,
          existingBooking.service.durationInMinutes,
        );
        return (
          isBefore(newBookingStart, existingEnd) &&
          isAfter(newBookingEnd, existingStart)
        );
      });

      if (hasConflict) {
        // Lança um erro específico que será capturado pelo bloco catch
        throw new Error("CONFLICT");
      }

      // 3. Se não houver conflito, criamos o agendamento
      return await tx.booking.create({
        data: {
          userId: session.user.id,
          serviceId,
          date: bookingDate,
          barbershopId,
          barberId,
          clientName,
          clientPhone,
          notes,
        },
      });
    });

    // Se a transação for bem-sucedida, revalidamos os paths
    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (session.user.id) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking };
  } catch (error: unknown) {
    // Captura o erro específico de conflito da nossa transação
    if (error instanceof Error && error.message === "CONFLICT") {
      return {
        success: false,
        error:
          "Este horário foi agendado por outra pessoa. Por favor, atualize e escolha um novo horário.",
      };
    }

    // Captura outros erros do Prisma ou erros genéricos
    console.error("[CREATE_BOOKING_ERROR]", error);
    return { success: false, error: "Ocorreu um erro ao criar o agendamento." };
  }
};

export async function deleteBooking(bookingId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para excluir agendamentos.",
    );
  }

  const bookingToDelete = await db.booking.findUnique({
    where: { id: bookingId },
    select: { barbershop: { select: { ownerId: true } }, userId: true },
  });

  if (!bookingToDelete) {
    throw new Error("Agendamento não encontrado.");
  }

  const isOwner = bookingToDelete.barbershop.ownerId === session.user.id;
  const isClient = bookingToDelete.userId === session.user.id;

  if (!isOwner && !isClient) {
    throw new Error("Você não tem permissão para excluir este agendamento.");
  }

  try {
    await db.booking.delete({
      where: { id: bookingId },
    });

    revalidatePath("/dashboard/agendamentos");
    if (isClient) {
      revalidatePath(`/meus-agendamentos`);
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao excluir agendamento:", error);
    throw new Error("Falha ao excluir o agendamento. Tente novamente.");
  }
}
