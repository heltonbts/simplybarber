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

import { setMilliseconds, startOfMinute } from "date-fns"; // adicione isso no topo

export async function getAvailableTimeSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  const zonedDate = toZonedTime(selectedDate, timeZone);
  const dayKey = formatInTimeZone(zonedDate, timeZone, "yyyy-MM-dd");
  const kvKey = `booking:${barbershopId}:${barberId}:${dayKey}`;

  const [cachedData, dbBookings, service] = await Promise.all([
    kv.smembers(kvKey),
    db.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: {
          gte: startOfDay(zonedDate),
          lt: endOfDay(zonedDate),
        },
      },
      include: {
        service: { select: { durationInMinutes: true } },
      },
    }),
    db.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    }),
  ]);

  if (!service) return [];

  const bookingsFromDb = dbBookings.map((b) => ({
    date: b.date,
    duration: b.service.durationInMinutes,
  }));

  const bookingsFromKv = (cachedData as string[]).flatMap((item) => {
    try {
      const parsed = JSON.parse(item);
      return [
        {
          date: new Date(parsed.date),
          duration: parsed.duration,
        },
      ];
    } catch {
      return [];
    }
  });

  const combinedBookings = [...bookingsFromDb, ...bookingsFromKv];

  const weekDay = getDay(zonedDate);
  const workingHour = await db.barbershopWorkingHour.findUnique({
    where: {
      barbershopId_weekDay: {
        barbershopId,
        weekDay,
      },
    },
  });

  if (!workingHour || !workingHour.isOpen) return [];

  const [openHour, openMinute] = workingHour.openTime.split(":").map(Number);
  const [closeHour, closeMinute] = workingHour.closeTime.split(":").map(Number);
  const startOfWorkDay = setMinutes(setHours(zonedDate, openHour), openMinute);
  const endOfWorkDay = setMinutes(setHours(zonedDate, closeHour), closeMinute);

  const lunchStart = workingHour.lunchStart
    ? setMinutes(
        setHours(zonedDate, Number(workingHour.lunchStart.split(":")[0])),
        Number(workingHour.lunchStart.split(":")[1]),
      )
    : null;

  const lunchEnd = workingHour.lunchEnd
    ? setMinutes(
        setHours(zonedDate, Number(workingHour.lunchEnd.split(":")[0])),
        Number(workingHour.lunchEnd.split(":")[1]),
      )
    : null;

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

    if (
      lunchStart &&
      lunchEnd &&
      isBefore(slotEnd, lunchStart) === false &&
      isAfter(slotStart, lunchEnd) === false
    ) {
      return false;
    }

    const conflict = combinedBookings.some((booking) => {
      const bookingStart = toZonedTime(booking.date, timeZone);
      const bookingEnd = addMinutes(bookingStart, booking.duration);

      return isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart);
    });

    return !conflict;
  });

  return availableSlots.map((slot) =>
    formatInTimeZone(slot, timeZone, "HH:mm"),
  );
}

export const createBooking = async ({
  serviceId,
  date,
  barbershopId,
  barberId,
  clientName,
  clientPhone,
  notes,
}: CreateBookingInput): Promise<CreateBookingResult> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Acesso não autorizado." };
  }

  const bookingDate = startOfMinute(setMilliseconds(new Date(date), 0));
  if (isNaN(bookingDate.getTime())) {
    return { success: false, error: "Data inválida." };
  }

  try {
    const service = await db.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });

    if (!service) return { success: false, error: "Serviço não encontrado." };

    const availableSlots = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    const requestedTime = formatInTimeZone(bookingDate, timeZone, "HH:mm");

    if (!availableSlots.includes(requestedTime)) {
      return {
        success: false,
        error: "Horário não disponível. Por favor, atualize e escolha outro.",
      };
    }

    const booking = await db.booking.create({
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

    const zonedDate = toZonedTime(booking.date, timeZone);
    const dayKey = formatInTimeZone(zonedDate, timeZone, "yyyy-MM-dd");
    const kvKey = `booking:${barbershopId}:${barberId}:${dayKey}`;
    const cacheValue = JSON.stringify({
      date: booking.date.toISOString(),
      duration: service.durationInMinutes,
    });

    const pipe = kv.pipeline();
    pipe.sadd(kvKey, cacheValue);
    pipe.expire(kvKey, 900); // 15 minutos
    await pipe.exec();

    const newAvailableSlots = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath(`/meus-agendamentos`);
    revalidatePath(`/dashboard/agendamentos`);

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
    return {
      success: false,
      error: "Ocorreu um erro ao criar o agendamento. Tente novamente.",
    };
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
