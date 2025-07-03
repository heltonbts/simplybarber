"use server";

import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
  format,
  getDay,
  setHours,
  setMinutes,
  addMinutes,
  isBefore,
  isAfter,
  isEqual,
} from "date-fns";

type CreateBookingInput = {
  barbershopId: string;
  serviceId: string;
  barberId: string;
  date: Date;
  clientName?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
};

async function getAvailableSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceDuration: number,
  barberId: string,
): Promise<string[]> {
  const weekDay = getDay(selectedDate);

  const barbershopWorkingHour = await db.barbershopWorkingHour.findUnique({
    where: {
      barbershopId_weekDay: {
        barbershopId,
        weekDay,
      },
    },
  });

  if (!barbershopWorkingHour || !barbershopWorkingHour.isOpen) {
    return [];
  }

  const [openHour, openMinute] = barbershopWorkingHour.openTime
    .split(":")
    .map(Number);
  const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
    .split(":")
    .map(Number);

  const startOfWorkDay = setMinutes(
    setHours(selectedDate, openHour),
    openMinute,
  );
  const endOfWorkDay = setMinutes(
    setHours(selectedDate, closeHour),
    closeMinute,
  );

  const existingBookings = await db.booking.findMany({
    where: {
      barbershopId,
      barberId,
      date: {
        gte: startOfWorkDay,
        lt: addMinutes(endOfWorkDay, serviceDuration),
      },
    },
    include: { service: { select: { durationInMinutes: true } } },
  });

  const bookedSlots: Date[] = [];
  existingBookings.forEach((booking) => {
    const bookingStart = booking.date;
    const bookingEnd = addMinutes(
      bookingStart,
      booking.service.durationInMinutes,
    );
    bookedSlots.push(bookingStart, bookingEnd);
  });

  const availableSlots: string[] = [];
  let currentTime = startOfWorkDay;

  while (
    isBefore(currentTime, endOfWorkDay) ||
    isEqual(currentTime, endOfWorkDay)
  ) {
    const potentialSlotEnd = addMinutes(currentTime, serviceDuration);

    if (
      isAfter(potentialSlotEnd, endOfWorkDay) &&
      !isEqual(potentialSlotEnd, endOfWorkDay)
    ) {
      break;
    }

    let isBlocked = false;

    if (barbershopWorkingHour.lunchStart && barbershopWorkingHour.lunchEnd) {
      const [lunchStartHour, lunchStartMinute] =
        barbershopWorkingHour.lunchStart.split(":").map(Number);
      const [lunchEndHour, lunchEndMinute] = barbershopWorkingHour.lunchEnd
        .split(":")
        .map(Number);

      const lunchStart = setMinutes(
        setHours(selectedDate, lunchStartHour),
        lunchStartMinute,
      );
      const lunchEnd = setMinutes(
        setHours(selectedDate, lunchEndHour),
        lunchEndMinute,
      );

      const overlapsLunch =
        (isBefore(currentTime, lunchEnd) &&
          isAfter(potentialSlotEnd, lunchStart)) ||
        isEqual(currentTime, lunchStart) ||
        isEqual(potentialSlotEnd, lunchEnd);

      if (overlapsLunch) {
        if (
          isBefore(currentTime, lunchStart) &&
          isAfter(potentialSlotEnd, lunchStart)
        ) {
          currentTime = lunchEnd;
        }
        isBlocked = true;
      }
    }

    if (!isBlocked) {
      for (const existingBooking of existingBookings) {
        const bookingStart = existingBooking.date;
        const bookingEnd = addMinutes(
          bookingStart,
          existingBooking.service.durationInMinutes,
        );

        const collision =
          (isBefore(currentTime, bookingEnd) &&
            isAfter(potentialSlotEnd, bookingStart)) ||
          isEqual(currentTime, bookingStart) ||
          isEqual(potentialSlotEnd, bookingEnd);

        if (collision) {
          isBlocked = true;
          currentTime = bookingEnd;
          break;
        }
      }
    }

    if (!isBlocked) {
      availableSlots.push(format(currentTime, "HH:mm"));
      currentTime = addMinutes(currentTime, serviceDuration);
    } else if (isBlocked && isAfter(currentTime, potentialSlotEnd)) {
      currentTime = addMinutes(currentTime, serviceDuration);
    } else {
      currentTime = addMinutes(currentTime, 1);
    }
  }

  return availableSlots;
}

export async function createBooking(data: CreateBookingInput) {
  const session = await getServerSession(authOptions);

  let userId: string | null = null;
  if (session?.user?.id) {
    userId = session.user.id;
  } else if (!data.clientName) {
    throw new Error(
      "Usuário não autenticado. Para agendamentos manuais, o nome do cliente é obrigatório.",
    );
  }

  if (!data.barbershopId || !data.serviceId || !data.barberId || !data.date) {
    throw new Error("Dados de agendamento incompletos.");
  }
  if (!(data.date instanceof Date) || isNaN(data.date.getTime())) {
    throw new Error("Data e hora do agendamento inválidas.");
  }

  const [barbershop, service, barber] = await Promise.all([
    db.barbershop.findUnique({ where: { id: data.barbershopId } }),
    db.barbershopService.findUnique({ where: { id: data.serviceId } }),
    db.barber.findUnique({ where: { id: data.barberId } }),
  ]);

  if (!barbershop || !service || !barber) {
    throw new Error("Barbearia, serviço ou barbeiro não encontrados.");
  }

  const availableSlots = await getAvailableSlots(
    data.barbershopId,
    data.date,
    service.durationInMinutes,
    data.barberId,
  );

  const requestedTime = format(data.date, "HH:mm");

  if (!availableSlots.includes(requestedTime)) {
    throw new Error(
      "Horário não disponível para este barbeiro. Por favor, escolha outro horário ou barbeiro.",
    );
  }

  const existingBookingAtTime = await db.booking.findUnique({
    where: {
      barberId_date: {
        barberId: data.barberId,
        date: data.date,
      },
    },
  });

  if (existingBookingAtTime) {
    throw new Error(
      "Já existe um agendamento para este barbeiro neste horário exato.",
    );
  }

  try {
    const newBooking = await db.booking.create({
      data: {
        userId: userId,
        barbershopId: data.barbershopId,
        serviceId: data.serviceId,
        barberId: data.barberId,
        date: data.date,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        notes: data.notes,
      },
    });

    revalidatePath("/dashboard/agendamentos");
    if (userId) {
      revalidatePath(`/bookings`);
    }

    console.log("Novo agendamento criado:", newBooking);
    return { success: true, booking: newBooking };
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    throw new Error(
      "Falha ao criar o agendamento. Verifique os dados e a disponibilidade.",
    );
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
      revalidatePath(`/bookings`);
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);
    throw new Error("Falha ao excluir o agendamento. Tente novamente.");
  }
}
