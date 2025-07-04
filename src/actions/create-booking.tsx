// actions/booking-actions.ts
"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  format,
  getDay,
  setHours,
  setMinutes,
  addMinutes,
  isBefore,
  isAfter,
  startOfMinute,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { sendExternalMessage } from "./send-external-message";
import { Prisma } from "../../generated/prisma";

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
}

export async function getAvailableTimeSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  const validatedDate = startOfMinute(new Date(selectedDate));

  const service = await db.barbershopService.findUnique({
    where: { id: serviceId },
    select: { durationInMinutes: true },
  });

  if (!service) {
    return [];
  }

  const weekDay = getDay(validatedDate);
  const barbershopWorkingHour = await db.barbershopWorkingHour.findUnique({
    where: {
      barbershopId_weekDay: {
        barbershopId,
        weekDay,
      },
    },
  });

  if (!barbershopWorkingHour?.isOpen) {
    return [];
  }

  const [openHour, openMinute] = barbershopWorkingHour.openTime
    .split(":")
    .map(Number);
  const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
    .split(":")
    .map(Number);

  const startOfWorkDay = setMinutes(
    setHours(validatedDate, openHour),
    openMinute,
  );
  const endOfWorkDay = setMinutes(
    setHours(validatedDate, closeHour),
    closeMinute,
  );

  const now = startOfMinute(new Date());

  const existingBookings = await db.booking.findMany({
    where: {
      barberId,
      barbershopId,
      date: {
        gte: startOfWorkDay,
        lt: endOfWorkDay,
      },
    },
    include: { service: { select: { durationInMinutes: true } } },
  });

  const lunchStart = barbershopWorkingHour.lunchStart
    ? setMinutes(
        setHours(
          validatedDate,
          Number(barbershopWorkingHour.lunchStart.split(":")[0]),
        ),
        Number(barbershopWorkingHour.lunchStart.split(":")[1]),
      )
    : null;

  const lunchEnd = barbershopWorkingHour.lunchEnd
    ? setMinutes(
        setHours(
          validatedDate,
          Number(barbershopWorkingHour.lunchEnd.split(":")[0]),
        ),
        Number(barbershopWorkingHour.lunchEnd.split(":")[1]),
      )
    : null;

  const availableSlots: string[] = [];
  let currentTime = startOfWorkDay;

  while (isBefore(currentTime, endOfWorkDay)) {
    const slotEnd = addMinutes(currentTime, service.durationInMinutes);

    if (isAfter(slotEnd, endOfWorkDay)) {
      break;
    }

    if (isBefore(currentTime, now)) {
      currentTime = addMinutes(currentTime, 15); // Avança em intervalos de 15min se o slot estiver no passado
      continue;
    }

    const overlapsWithLunch =
      lunchStart &&
      lunchEnd &&
      isBefore(currentTime, lunchEnd) &&
      isAfter(slotEnd, lunchStart);

    if (overlapsWithLunch) {
      currentTime = lunchEnd as Date;
      continue;
    }

    const conflictingBooking = existingBookings.find((booking) => {
      const bookingStart = startOfMinute(booking.date);
      const bookingEnd = addMinutes(
        bookingStart,
        booking.service.durationInMinutes,
      );
      return (
        isBefore(currentTime, bookingEnd) && isAfter(slotEnd, bookingStart)
      );
    });

    if (conflictingBooking) {
      currentTime = addMinutes(
        startOfMinute(conflictingBooking.date),
        conflictingBooking.service.durationInMinutes,
      );
      continue;
    }

    availableSlots.push(format(currentTime, "HH:mm"));
    currentTime = slotEnd;
  }

  return availableSlots;
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

    let bookingUserId: string | null = null;
    if (clientName && clientName.trim().length > 0) {
      bookingUserId = null;
    } else if (session?.user?.id) {
      bookingUserId = session.user.id;
    } else {
      return {
        success: false,
        error:
          "Para agendamentos manuais, o nome do cliente é obrigatório. Para agendamentos de usuário, faça login.",
      };
    }

    if (!serviceId || !date || !barbershopId || !barberId) {
      return {
        success: false,
        error:
          "Dados de agendamento incompletos (serviço, data, barbearia ou barbeiro faltando).",
      };
    }

    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return {
        success: false,
        error: "Data ou hora do agendamento inválidas.",
      };
    }
    if (bookingDate < new Date()) {
      return {
        success: false,
        error: "Não é possível agendar para uma data ou horário no passado.",
      };
    }

    const service = await db.barbershopService.findUnique({
      where: { id: serviceId },
      select: {
        durationInMinutes: true,
        name: true,
        price: true,
        barbershop: true,
      },
    });
    if (!service) {
      return { success: false, error: "Serviço não encontrado." };
    }
    if (!service.barbershop) {
      return {
        success: false,
        error: "Barbearia associada ao serviço não encontrada.",
      };
    }

    const availableSlotsAtCreateTime = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    const requestedTime = format(bookingDate, "HH:mm");
    if (!availableSlotsAtCreateTime.includes(requestedTime)) {
      return {
        success: false,
        error:
          "Horário não disponível. Alguém pode ter agendado. Por favor, escolha outro horário ou barbeiro.",
      };
    }

    const booking = await db.booking.create({
      data: {
        userId: bookingUserId,
        serviceId,
        date: bookingDate,
        barbershopId,
        barberId,
        clientName: clientName,
        clientPhone: clientPhone,
        notes: notes,
      },
      include: {
        service: {
          select: { name: true, price: true, durationInMinutes: true },
        },
        barbershop: { select: { name: true, address: true } },
        user: { select: { phone: true, name: true } },
        barber: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    const barbershopName = booking.barbershop.name;
    const serviceName = booking.service.name;
    const barberName = booking.barber.user.name || "um barbeiro";
    const formattedBookingDate = format(booking.date, "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    });

    const baseMessage = `Agendamento Confirmado! Você marcou um serviço de ${serviceName} na ${barbershopName} com ${barberName} na data de ${formattedBookingDate}.`;

    if (booking.user?.phone && booking.user.phone.length > 0) {
      await sendExternalMessage({
        to: booking.user.phone[0],
        message: baseMessage,
      });
    } else if (booking.clientPhone && booking.clientPhone.length > 0) {
      await sendExternalMessage({
        to: booking.clientPhone,
        message: baseMessage,
      });
    } else {
      console.warn(
        `Agendamento de ${booking.clientName || booking.user?.name || "cliente desconhecido"} não possui telefone para envio de mensagem de confirmação.`,
      );
    }

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (bookingUserId) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking };
  } catch (error: unknown) {
    console.error("Erro ao criar agendamento:", error);
    let errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      errorMessage = (error as { message: string }).message;
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
    console.error("Erro ao excluir agendamento:", error);
    throw new Error("Falha ao excluir o agendamento. Tente novamente.");
  }
}
