"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { kv } from "@vercel/kv"; // 1. Importa o Vercel KV
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
  Booking,
  BarbershopService,
  User,
  Prisma,
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

  const zonedDate = toZonedTime(selectedDate, timeZone);
  const dayKey = formatInTimeZone(zonedDate, timeZone, "yyyy-MM-dd");
  const kvKey = `booking:${barbershopId}:${barberId}:${dayKey}`;

  // 2. Busca no cache rápido (KV) e no banco de dados ao mesmo tempo
  const [cachedBookingTimes, dbBookings, service] = await Promise.all([
    kv.smembers(kvKey),
    db.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: { gte: startOfDay(zonedDate), lt: endOfDay(zonedDate) },
      },
      include: { service: { select: { durationInMinutes: true } } },
    }),
    db.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    }),
  ]);

  if (!service) return [];

  // 3. Combina os resultados para ter a visão mais completa e atualizada
  const dbBookingTimes = new Set(dbBookings.map((b) => b.date.toISOString()));
  const allBookedTimes = new Set([...cachedBookingTimes, ...dbBookingTimes]);

  const combinedBookings = Array.from(allBookedTimes).map((isoString) => {
    const dbEquivalent = dbBookings.find(
      (b) => b.date.toISOString() === isoString,
    );
    return {
      date: new Date(isoString),
      service: {
        durationInMinutes:
          dbEquivalent?.service.durationInMinutes || service.durationInMinutes,
      },
    };
  });

  // O resto da sua lógica de filtragem continua a mesma, mas agora usa combinedBookings
  const weekDay = getDay(zonedDate);
  const barbershopWorkingHour = await db.barbershopWorkingHour.findUnique({
    where: { barbershopId_weekDay: { barbershopId, weekDay } },
  });
  if (!barbershopWorkingHour?.isOpen) return [];

  // ... (código para gerar potentialSlots) ...
  const [openHour, openMinute] = barbershopWorkingHour.openTime
    .split(":")
    .map(Number);
  const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
    .split(":")
    .map(Number);
  const startOfWorkDay = setMinutes(setHours(zonedDate, openHour), openMinute);
  const endOfWorkDay = setMinutes(setHours(zonedDate, closeHour), closeMinute);
  const nowInZone = toZonedTime(new Date(), timeZone);
  const potentialSlots: Date[] = [];
  let currentTime = startOfWorkDay;
  while (isBefore(currentTime, endOfWorkDay)) {
    potentialSlots.push(currentTime);
    currentTime = addMinutes(currentTime, 15);
  }

  const availableSlots = potentialSlots.filter((slotStart) => {
    const slotEnd = addMinutes(slotStart, service.durationInMinutes);
    if (isAfter(slotEnd, endOfWorkDay) || isBefore(slotStart, nowInZone))
      return false;

    const hasConflict = combinedBookings.some((booking) => {
      const bookingStart = toZonedTime(booking.date, timeZone);
      const bookingEnd = addMinutes(
        bookingStart,
        booking.service.durationInMinutes,
      );
      return isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart);
    });

    if (hasConflict) return false;
    return true;
  });

  return availableSlots.map((date) =>
    formatInTimeZone(date, timeZone, "HH:mm"),
  );
}

export const createBooking = async ({
  serviceId,
  date,
  barbershopId,
  barberId,
}: CreateBookingInput): Promise<CreateBookingResult> => {
  noStore();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return { success: false, error: "Acesso não autorizado." };

  const bookingDate = new Date(date);

  try {
    const booking = await db.booking.create({
      data: {
        userId: session.user.id,
        serviceId,
        date: bookingDate,
        barbershopId,
        barberId,
      },
    });

    // 4. Após o sucesso, salva a informação no cache rápido (KV)
    const zonedDate = toZonedTime(booking.date, timeZone);
    const dayKey = formatInTimeZone(zonedDate, timeZone, "yyyy-MM-dd");
    const kvKey = `booking:${barbershopId}:${barberId}:${dayKey}`;

    await kv.sadd(kvKey, booking.date.toISOString());
    // Define um tempo de expiração para a chave (ex: 15 minutos) para não acumular lixo
    await kv.expire(kvKey, 900);

    // A lógica de "read-once, filter-in-memory" não é mais necessária aqui,
    // pois a próxima leitura em getAvailableTimeSlots já usará o KV.
    // Mas podemos mantê-la para a resposta imediata ser mais rápida.
    const availableSlotsBeforeBooking = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );
    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== formatInTimeZone(bookingDate, timeZone, "HH:mm"),
    );

    revalidatePath(`/barbershops/${barbershopId}`);

    return { success: true, booking, newAvailableSlots };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error:
          "Este horário foi agendado por outra pessoa. Por favor, atualize e escolha um novo horário.",
      };
    }
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
