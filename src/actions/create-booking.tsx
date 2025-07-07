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
import { sendExternalMessage } from "./send-external-message";
import {
  Prisma,
  Booking,
  BarbershopService,
  User,
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
  try {
    const session = await getServerSession(authOptions);
    const bookingDate = new Date(date);

    if (isNaN(bookingDate.getTime())) {
      return { success: false, error: "Data inválida." };
    }

    const availableSlotsBeforeBooking = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    const requestedTime = formatInTimeZone(bookingDate, timeZone, "HH:mm");

    if (!availableSlotsBeforeBooking.includes(requestedTime)) {
      return {
        success: false,
        error:
          "Horário não disponível. Alguém pode ter agendado. Por favor, escolha outro.",
      };
    }

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

    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== requestedTime,
    );

    const barbershopName = booking.barbershop.name;
    const serviceName = booking.service.name;
    const barberName = booking.barber.user.name || "um barbeiro";
    const formattedBookingDateForMessage = formatInTimeZone(
      booking.date,
      timeZone,
      "dd/MM/yyyy 'às' HH:mm",
      {
        locale: ptBR,
      },
    );
    const baseMessage = `Agendamento Confirmado! Você marcou ${serviceName} na ${barbershopName} com ${barberName} para ${formattedBookingDateForMessage}.`;

    if (booking.user?.phone && booking.user.phone.length > 0) {
      await sendExternalMessage({
        to: booking.user.phone,
        message: baseMessage,
      });
    } else if (booking.clientPhone && booking.clientPhone.length > 0) {
      await sendExternalMessage({
        to: booking.clientPhone,
        message: baseMessage,
      });
    }

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (session?.user?.id) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking, newAvailableSlots };
  } catch (error: unknown) {
    console.error("❌ Erro ao criar agendamento:", error);
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
