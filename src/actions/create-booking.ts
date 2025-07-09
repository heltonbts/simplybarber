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
  parseISO,
  areIntervalsOverlapping,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Booking, BarbershopService, User } from "../../generated/prisma";
import {
  createBrazilDateTime,
  toBrazilTime,
  TIMEZONE,
} from "@/lib/timezone-utils";

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
  selectedDate: Date, // A data que vem da API, ex: 2025-07-09T12:00:00.000Z
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  nextCacheNoStore();

  return await db.$transaction(async (tx) => {
    // 1. Busca dados essenciais (sem mudança aqui)
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

    // --- LÓGICA DE DATAS REFEITA E ROBUSTA ---

    // 2. Crie os limites do dia de trabalho DIRETAMENTE EM UTC
    // Pega a data "local" do Brasil e as horas de trabalho e converte para o UTC correspondente.
    const dateString = formatInTimeZone(selectedDate, TIMEZONE, "yyyy-MM-dd");
    const startOfWorkDayUTC = fromZonedTime(
      `${dateString}T${barbershopWorkingHour.openTime}`,
      TIMEZONE,
    );
    const endOfWorkDayUTC = fromZonedTime(
      `${dateString}T${barbershopWorkingHour.closeTime}`,
      TIMEZONE,
    );

    // 3. Busque os agendamentos existentes usando um intervalo UTC explícito
    const startOfDayUTC = fromZonedTime(`${dateString}T00:00:00`, TIMEZONE);
    const endOfDayUTC = fromZonedTime(`${dateString}T23:59:59`, TIMEZONE);

    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });

    // 4. Gere os slots potenciais em UTC
    const potentialSlotsUTC: Date[] = [];
    let currentTimeUTC = startOfWorkDayUTC;
    while (currentTimeUTC < endOfWorkDayUTC) {
      potentialSlotsUTC.push(new Date(currentTimeUTC));
      currentTimeUTC = addMinutes(currentTimeUTC, 15);
    }

    // 5. Filtre os slots comparando tudo em UTC
    const nowUTC = new Date(); // A hora atual já é UTC por padrão

    const availableSlotsUTC = potentialSlotsUTC.filter((slotStartUTC) => {
      const slotEndUTC = addMinutes(slotStartUTC, service.durationInMinutes);

      // Checagem #1: O slot termina depois do expediente?
      if (slotEndUTC > endOfWorkDayUTC) return false;

      // Checagem #2: O slot já passou? (só para o dia de hoje)
      if (isBefore(slotStartUTC, nowUTC)) return false;

      // Checagem #3: O slot conflita com agendamentos existentes?
      return !existingBookings.some((booking) =>
        areIntervalsOverlapping(
          { start: slotStartUTC, end: slotEndUTC },
          {
            start: booking.date,
            end: addMinutes(booking.date, booking.service.durationInMinutes),
          },
          { inclusive: false },
        ),
      );
    });

    // 6. Formate o resultado final para o usuário
    // Converte os slots UTC válidos para strings de hora no fuso do Brasil
    return availableSlotsUTC.map((utcDate) =>
      formatInTimeZone(utcDate, TIMEZONE, "HH:mm"),
    );
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
