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
  isEqual,
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
  console.log("\n--- getAvailableTimeSlots Debug Start ---");
  console.log(
    "Input: barbershopId:",
    barbershopId,
    "selectedDate (from input):",
    selectedDate.toISOString(),
    "serviceId:",
    serviceId,
    "barberId:",
    barberId,
  );

  const validatedDate = new Date(selectedDate);
  if (isNaN(validatedDate.getTime())) {
    console.error("Debug: getAvailableTimeSlots: Data inválida.");
    return [];
  }
  console.log("Debug: validatedDate (processed):", validatedDate.toISOString());

  const service = await db.barbershopService.findUnique({
    where: { id: serviceId },
    select: { durationInMinutes: true },
  });

  if (!service) {
    console.error(`Debug: Serviço com ID ${serviceId} não encontrado.`);
    return [];
  }
  console.log("Debug: Service Duration:", service.durationInMinutes);

  const weekDay = getDay(validatedDate);
  console.log("Debug: WeekDay (0=Sun, 1=Mon, 4=Thu):", weekDay);

  const barbershopWorkingHour = await db.barbershopWorkingHour.findUnique({
    where: {
      barbershopId_weekDay: {
        barbershopId,
        weekDay,
      },
    },
  });

  if (!barbershopWorkingHour) {
    console.log(
      "Debug: NO working hour config found for this day and barbershop.",
    );
    return []; // <-- POSSÍVEL PONTO DE SAÍDA
  }
  if (!barbershopWorkingHour.isOpen) {
    console.log(
      "Debug: Working hour config found, but barbershop is closed for this day.",
    );
    return []; // <-- POSSÍVEL PONTO DE SAÍDA
  }
  console.log(
    "Debug: Barbearia Horário (DB):",
    barbershopWorkingHour.openTime,
    "-",
    barbershopWorkingHour.closeTime,
    "Lunch:",
    barbershopWorkingHour.lunchStart,
    "-",
    barbershopWorkingHour.lunchEnd,
  );

  const [openHour, openMinute] = barbershopWorkingHour.openTime
    .split(":")
    .map(Number);
  const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
    .split(":")
    .map(Number);

  const startOfWorkDay = startOfMinute(
    setMinutes(setHours(validatedDate, openHour), openMinute),
  );
  const endOfWorkDay = startOfMinute(
    setMinutes(setHours(validatedDate, closeHour), closeMinute),
  );
  console.log(
    "Debug: StartOfWorkDay (calculated):",
    format(startOfWorkDay, "HH:mm"),
    "EndOfWorkDay (calculated):",
    format(endOfWorkDay, "HH:mm"),
  );

  if (
    isAfter(startOfWorkDay, endOfWorkDay) &&
    !isEqual(startOfWorkDay, endOfWorkDay)
  ) {
    console.log(
      "Debug: Start of workday is AFTER end of workday. Invalid hours.",
    );
    return []; // <-- POSSÍVEL PONTO DE SAÍDA
  }

  const now = new Date(); // Current server time
  const nowNormalized = startOfMinute(now); // Normalized current server time
  console.log(
    "Debug: Current Server Time Normalized:",
    format(nowNormalized, "HH:mm"),
  );

  // --- Existing Bookings (should be empty if DB is clear) ---
  const existingBookings = await db.booking.findMany({
    where: {
      barberId,
      barbershopId,
      date: {
        gte: startOfWorkDay,
        lte: addMinutes(endOfWorkDay, service.durationInMinutes),
      },
    },
    include: { service: { select: { durationInMinutes: true } } },
  });
  console.log(
    "Debug: Number of existing bookings found:",
    existingBookings.length,
  );
  // Fim: Existing Bookings

  const availableSlots: string[] = [];
  let currentTime = startOfWorkDay;

  console.log("Debug: Starting while loop from:", format(currentTime, "HH:mm"));
  console.log("Debug: Looping until:", format(endOfWorkDay, "HH:mm"));

  while (
    isBefore(currentTime, endOfWorkDay) ||
    isEqual(currentTime, endOfWorkDay)
  ) {
    const potentialSlotEnd = startOfMinute(
      addMinutes(currentTime, service.durationInMinutes),
    );

    console.log(
      `Debug: Checking slot from ${format(currentTime, "HH:mm")} to ${format(potentialSlotEnd, "HH:mm")}`,
    );

    // --- 1. Filter out slots that go past end of day ---
    if (
      isAfter(potentialSlotEnd, endOfWorkDay) &&
      !isEqual(potentialSlotEnd, endOfWorkDay)
    ) {
      console.log("Debug: Slot goes past end of workday. Breaking loop.");
      break;
    }

    // --- 2. Filter out slots that are completely in the past ---
    // This check determines if the *start* of the current slot is already in the past
    if (isBefore(currentTime, nowNormalized)) {
      console.log(
        `Debug: Slot ${format(currentTime, "HH:mm")} is in the past compared to now (${format(nowNormalized, "HH:mm")}). Advancing currentTime.`,
      );
      currentTime = addMinutes(currentTime, 1); // Advance by 1 minute to check next granular point
      continue;
    }
    // --- Fim: Filter out slots that are completely in the past ---

    let isBlocked = false;
    let nextPotentialAdvanceTime = addMinutes(
      currentTime,
      service.durationInMinutes,
    );

    // --- 3. Check for lunch break overlap ---
    if (barbershopWorkingHour.lunchStart && barbershopWorkingHour.lunchEnd) {
      const [lunchStartHour, lunchStartMinute] =
        barbershopWorkingHour.lunchStart.split(":").map(Number);
      const [lunchEndHour, lunchEndMinute] = barbershopWorkingHour.lunchEnd
        .split(":")
        .map(Number);

      const lunchStart = startOfMinute(
        setMinutes(setHours(validatedDate, lunchStartHour), lunchStartMinute),
      );
      const lunchEnd = startOfMinute(
        setMinutes(setHours(validatedDate, lunchEndHour), lunchEndMinute),
      );

      const overlapsLunch =
        (isBefore(currentTime, lunchEnd) &&
          isAfter(potentialSlotEnd, lunchStart)) ||
        isEqual(currentTime, lunchStart) ||
        isEqual(potentialSlotEnd, lunchEnd);

      if (overlapsLunch) {
        isBlocked = true;
        nextPotentialAdvanceTime = lunchEnd;
        console.log(
          `Debug: Slot ${format(currentTime, "HH:mm")} blocked by lunch. Next check at ${format(nextPotentialAdvanceTime, "HH:mm")}`,
        );
      }
    }

    // --- 4. Check for existing bookings overlap ---
    if (!isBlocked) {
      for (const existingBooking of existingBookings) {
        const bookingStart = startOfMinute(existingBooking.date);
        const bookingEnd = startOfMinute(
          addMinutes(bookingStart, existingBooking.service.durationInMinutes),
        );

        const collision =
          (isBefore(currentTime, bookingEnd) &&
            isAfter(potentialSlotEnd, bookingStart)) ||
          isEqual(currentTime, bookingStart) ||
          isEqual(potentialSlotEnd, bookingEnd);

        if (collision) {
          isBlocked = true;
          nextPotentialAdvanceTime = bookingEnd;
          console.log(
            `Debug: Slot ${format(currentTime, "HH:mm")} blocked by existing booking. Next check at ${format(nextPotentialAdvanceTime, "HH:mm")}`,
          );
          break;
        }
      }
    }

    // --- 5. Add slot or advance time ---
    if (!isBlocked) {
      availableSlots.push(format(currentTime, "HH:mm"));
      currentTime = nextPotentialAdvanceTime;
      console.log(
        `Debug: Slot ${format(currentTime, "HH:mm")} ADDED. Next check at ${format(currentTime, "HH:mm")}`,
      );
    } else {
      currentTime = nextPotentialAdvanceTime;
      console.log(
        `Debug: Slot ${format(currentTime, "HH:mm")} BLOCKED. Next check at ${format(currentTime, "HH:mm")}`,
      );
    }
  }

  console.log("Debug: Final Available Slots:", availableSlots);
  console.log("--- getAvailableTimeSlots Debug End ---\n");
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
