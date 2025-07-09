/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  revalidatePath,
  unstable_noStore as nextCacheNoStore,
} from "next/cache";
import {
  getDay,
  addMinutes,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
  format,
  setMinutes,
  setHours,
  parseISO,
  areIntervalsOverlapping,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { Booking, BarbershopService, User } from "../../generated/prisma";
import { createBrazilDateTime, toBrazilTime } from "@/lib/timezone-utils";

export interface CreateBookingInput {
  userId: string | null;
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

  const timeZone = "America/Sao_Paulo";
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
      data: toBrazilTime(booking.date),
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
  selectedDate: Date, // A data já vem corrigida da API como `new Date('YYYY-MM-DDTHH:mm:ss')`
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  nextCacheNoStore();

  return await db.$transaction(async (tx) => {
    // 1. Busca dados essenciais
    const service = await tx.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });

    const weekDay = getDay(selectedDate);
    const barbershopWorkingHour = await tx.barbershopWorkingHour.findUnique({
      where: { barbershopId_weekDay: { barbershopId, weekDay } },
    });

    if (!service || !barbershopWorkingHour?.isOpen) {
      return [];
    }

    // 2. Busca agendamentos existentes na data selecionada
    const brazilDate = toBrazilTime(selectedDate);
    const startOfSelectedDay = startOfDay(brazilDate);
    const endOfSelectedDay = endOfDay(brazilDate);

    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: {
          gte: startOfSelectedDay,
          lte: endOfSelectedDay,
        },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });

    // 3. Prepara horários de trabalho no fuso horário local (Brasil)
    const [openHour, openMinute] = barbershopWorkingHour.openTime
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
      .split(":")
      .map(Number);
    const startOfWorkDay = setMinutes(
      setHours(startOfSelectedDay, openHour),
      openMinute,
    );
    const endOfWorkDay = setMinutes(
      setHours(startOfSelectedDay, closeHour),
      closeMinute,
    );

    // 4. Gera slots potenciais no fuso horário local
    const potentialSlots: Date[] = [];
    let currentTime = startOfWorkDay;
    while (isBefore(currentTime, endOfWorkDay)) {
      potentialSlots.push(new Date(currentTime));
      currentTime = addMinutes(currentTime, 15);
    }

    const now = toBrazilTime(new Date());

    const existingBookingsInBrazilTime = existingBookings.map((booking) => {
      const bookingStartBrazil = toBrazilTime(booking.date);
      return {
        start: bookingStartBrazil,
        end: addMinutes(bookingStartBrazil, booking.service.durationInMinutes),
      };
    });

    // 5. Filtra os slots comparando todos no mesmo fuso horário
    const availableSlots = potentialSlots.filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, service.durationInMinutes);

      if (isAfter(slotEnd, endOfWorkDay)) return false;
      if (isBefore(slotStart, now)) return false;

      // Compara os slots (em fuso local) com os agendamentos (agora também em fuso local)
      return !existingBookingsInBrazilTime.some((booking) =>
        areIntervalsOverlapping(
          { start: slotStart, end: slotEnd },
          { start: booking.start, end: booking.end },
          { inclusive: false },
        ),
      );
    });

    return availableSlots.map((date) => format(date, "HH:mm"));
  });
}

export async function createBookingAction(
  barbershopId: string,
  barberId: string,
  serviceId: string,
  userId: string | null,
  selectedDate: string,
  selectedTime: string,
  clientName?: string,
  clientPhone?: string,
  notes?: string,
) {
  nextCacheNoStore();

  try {
    const selectedDateObj = parseISO(selectedDate);

    // 1. REVALIDAÇÃO: Busca os horários realmente disponíveis no exato momento da criação.
    const availableSlots = await getAvailableTimeSlots(
      barbershopId,
      selectedDateObj,
      serviceId,
      barberId,
    );

    // 2. VERIFICAÇÃO: Confirma se o horário enviado pelo cliente ainda está na lista.
    const isSlotStillAvailable = availableSlots.includes(selectedTime);

    if (!isSlotStillAvailable) {
      console.error(
        `TENTATIVA DE AGENDAMENTO CONFLITANTE: O horário ${selectedTime} não está mais disponível.`,
      );
      throw new Error(
        "Este horário foi agendado por outra pessoa. Por favor, escolha outro.",
      );
    }

    // 3. CRIAÇÃO: Se o horário passou na verificação, cria o agendamento.
    const bookingDateUTC = createBrazilDateTime(selectedDate, selectedTime);

    const data: any = {
      barbershopId,
      barberId,
      serviceId,
      date: bookingDateUTC,
      clientName,
      clientPhone,
      notes,
    };

    // Adiciona userId somente se for válido
    if (userId) {
      data.userId = userId;
    }

    const booking = await db.booking.create({ data });

    // Revalida os paths para atualizar a UI em outros lugares
    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/meus-agendamentos");

    return { success: true, booking };
  } catch (error) {
    console.error("Erro ao criar booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

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
// Removed duplicate local noStore function to resolve naming conflict.
