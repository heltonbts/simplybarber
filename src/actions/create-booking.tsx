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
import {
  Prisma,
  Booking,
  BarbershopService,
  User,
} from "../../generated/prisma";

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

export type BookingResponseDetails = Prisma.BookingGetPayload<{
  include: {
    service: {
      select: {
        name: true;
        price: true;
        durationInMinutes: true;
      };
    };
    barbershop: {
      select: {
        name: true;
        address: true;
      };
    };
    user: {
      select: {
        phone: true;
        name: true;
      };
    };
    barber: {
      select: {
        id: true;
        user: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

export interface CreateBookingResult {
  success: boolean;
  booking?: BookingResponseDetails;
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
  console.log(
    `[GET_SLOTS_DEBUG] Iniciando para data: ${selectedDate.toISOString()}`,
  );

  return await db.$transaction(async (tx) => {
    const service = await tx.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });
    if (!service) {
      console.error("[GET_SLOTS_DEBUG] ERRO: Serviço não encontrado.");
      return [];
    }
    console.log(
      `[GET_SLOTS_DEBUG] Serviço encontrado, duração: ${service.durationInMinutes} min.`,
    );

    const zonedDate = toZonedTime(selectedDate, timeZone);
    const weekDay = getDay(zonedDate);
    console.log(
      `[GET_SLOTS_DEBUG] Data no fuso (${timeZone}): ${zonedDate.toISOString()}, Dia da semana: ${weekDay}`,
    );

    const barbershopWorkingHour = await tx.barbershopWorkingHour.findUnique({
      where: { barbershopId_weekDay: { barbershopId, weekDay } },
    });
    if (!barbershopWorkingHour?.isOpen) {
      console.warn(
        "[GET_SLOTS_DEBUG] Barbearia fechada neste dia ou horário de funcionamento não cadastrado.",
      );
      return [];
    }
    console.log(
      `[GET_SLOTS_DEBUG] Horário de funcionamento: ${barbershopWorkingHour.openTime} - ${barbershopWorkingHour.closeTime}`,
    );

    const start = startOfDay(zonedDate);
    const end = endOfDay(zonedDate);

    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: { gte: start, lt: end },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });
    console.log(
      `[GET_SLOTS_DEBUG] Encontrados ${existingBookings.length} agendamentos existentes no dia.`,
    );

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
    console.log(
      `[GET_SLOTS_DEBUG] Gerados ${potentialSlots.length} slots potenciais de 15 em 15 min.`,
    );

    const availableSlots = potentialSlots.filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, service.durationInMinutes);

      if (isAfter(slotEnd, endOfWorkDay)) {
        // console.log(`[GET_SLOTS_DEBUG] FILTRADO (após expediente): ${formatInTimeZone(slotStart, timeZone, "HH:mm")}`);
        return false;
      }
      if (isBefore(slotStart, nowInZone)) {
        // console.log(`[GET_SLOTS_DEBUG] FILTRADO (passado): ${formatInTimeZone(slotStart, timeZone, "HH:mm")}`);
        return false;
      }

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
      ) {
        // console.log(`[GET_SLOTS_DEBUG] FILTRADO (almoço): ${formatInTimeZone(slotStart, timeZone, "HH:mm")}`);
        return false;
      }

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = toZonedTime(booking.date, timeZone);
        const bookingEnd = addMinutes(
          bookingStart,
          booking.service.durationInMinutes,
        );
        const conflict =
          isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart);
        // if (conflict) console.log(`[GET_SLOTS_DEBUG] FILTRADO (conflito): ${formatInTimeZone(slotStart, timeZone, "HH:mm")}`);
        return conflict;
      });

      if (hasConflict) return false;
      return true;
    });

    console.log(
      `[GET_SLOTS_DEBUG] Final: ${availableSlots.length} horários disponíveis retornados.`,
    );
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
  try {
    console.log(
      `[PROD-DEBUG] Action createBooking INICIADA às ${new Date().toISOString()}`,
    );
    const session = await getServerSession(authOptions);
    const bookingDate = new Date(date);

    if (isNaN(bookingDate.getTime())) {
      console.error("[PROD-DEBUG] ERRO: Data inválida recebida.");
      return { success: false, error: "Data inválida." };
    }

    console.log(
      "[PROD-DEBUG] Chamando getAvailableTimeSlots ANTES de criar o booking...",
    );
    const availableSlotsBeforeBooking = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );
    console.log(
      `[PROD-DEBUG] Horários retornados por getAvailableTimeSlots: ${availableSlotsBeforeBooking.length} slots.`,
    );

    const requestedTime = formatInTimeZone(bookingDate, timeZone, "HH:mm");
    console.log(`[PROD-DEBUG] Usuário solicitou o horário: ${requestedTime}`);

    if (!availableSlotsBeforeBooking.includes(requestedTime)) {
      console.error(
        `[PROD-DEBUG] ERRO: Horário ${requestedTime} não está na lista de disponíveis. Lista:`,
        availableSlotsBeforeBooking,
      );
      return {
        success: false,
        error: "Horário não disponível. Por favor, escolha outro.",
      };
    }

    console.log(
      "[PROD-DEBUG] Validação OK. Criando agendamento no banco de dados...",
    );
    const booking = await db.booking.create({
      data: {
        userId: session?.user?.id,
        serviceId,
        date: bookingDate,
        barbershopId,
        barberId,
        clientName,
        clientPhone,
        notes,
      },
      include: {
        service: true,
        barbershop: true,
        user: true,
        barber: { include: { user: true } },
      },
    });

    console.log(
      `[PROD-DEBUG] SUCESSO: Booking criado no DB com ID: ${booking.id}`,
    );

    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== requestedTime,
    );

    console.log(
      `[PROD-DEBUG] Lista de horários atualizada em memória. Novo total: ${newAvailableSlots.length} slots.`,
    );

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (session?.user?.id) {
      revalidatePath("/meus-agendamentos");
    }

    console.log("[PROD-DEBUG] Retornando sucesso para o frontend.");
    return { success: true, booking, newAvailableSlots };
  } catch (error: unknown) {
    console.error("[PROD-DEBUG] ERRO CRÍTICO NO BLOCO CATCH:", error);
    let errorMessage = "Erro interno do servidor.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
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
