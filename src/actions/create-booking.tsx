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
  selectedDate: Date, // A data COMPLETA (incluindo hora 00:00:00 para o dia)
  serviceId: string, // Passamos o serviceId para obter a duração
  barberId: string, // Passamos o barberId para filtrar os agendamentos
): Promise<string[]> {
  if (!barbershopId || !selectedDate || !serviceId || !barberId) {
    console.error("getAvailableTimeSlots: Parâmetros incompletos.");
    return [];
  }
  const validatedDate = new Date(selectedDate);
  if (isNaN(validatedDate.getTime())) {
    console.error("getAvailableTimeSlots: Data inválida.");
    return [];
  }

  const service = await db.barbershopService.findUnique({
    where: { id: serviceId },
    select: { durationInMinutes: true },
  });

  if (!service) {
    console.error(
      `getAvailableTimeSlots: Serviço com ID ${serviceId} não encontrado.`,
    );
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

  if (!barbershopWorkingHour || !barbershopWorkingHour.isOpen) {
    return []; // Barbearia fechada neste dia
  }

  const [openHour, openMinute] = barbershopWorkingHour.openTime
    .split(":")
    .map(Number);
  const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
    .split(":")
    .map(Number);

  // Normaliza todas as datas para o início do minuto para evitar problemas com milissegundos
  const startOfWorkDay = startOfMinute(
    setMinutes(setHours(validatedDate, openHour), openMinute),
  );
  const endOfWorkDay = startOfMinute(
    setMinutes(setHours(validatedDate, closeHour), closeMinute),
  );

  // Obter agendamentos existentes para o barbeiro na data selecionada
  // Usar lte no `date` do `where` para ser inclusivo até o final do expediente.
  const existingBookings = await db.booking.findMany({
    where: {
      barberId,
      barbershopId,
      date: {
        gte: startOfWorkDay,
        lte: addMinutes(endOfWorkDay, service.durationInMinutes), // Inclui agendamentos que terminam no final do dia
      },
    },
    include: { service: { select: { durationInMinutes: true } } },
  });

  const availableSlots: string[] = [];
  let currentTime = startOfWorkDay; // Começa normalizado

  const now = new Date(); // Hora atual para comparar e não mostrar slots no passado
  const nowNormalized = startOfMinute(now); // Normaliza a hora atual

  while (
    isBefore(currentTime, endOfWorkDay) ||
    isEqual(currentTime, endOfWorkDay)
  ) {
    const potentialSlotEnd = startOfMinute(
      addMinutes(currentTime, service.durationInMinutes),
    ); // Normaliza o fim do slot

    // 1. Condições de Saída Antecipada / Pulo de Horário Passado
    if (
      isAfter(potentialSlotEnd, endOfWorkDay) &&
      !isEqual(potentialSlotEnd, endOfWorkDay)
    ) {
      break; // Slot ultrapassa o fim do expediente
    }
    if (isBefore(potentialSlotEnd, nowNormalized)) {
      // Slot já está no passado (considerando a duração)
      currentTime = addMinutes(potentialSlotEnd, 1); // Pula para 1 minuto após o fim do slot passado
      continue;
    }

    let isBlocked = false;
    let nextPotentialAdvanceTime = addMinutes(
      currentTime,
      service.durationInMinutes,
    );

    // 2. Verificar intervalo de almoço/pausa da barbearia
    // === CORREÇÃO AQUI: USAR 'barbershopWorkingHour' EM VEZ DE 'workingHour' ===
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
        if (
          isBefore(currentTime, lunchEnd) &&
          !isEqual(currentTime, lunchEnd)
        ) {
          nextPotentialAdvanceTime = lunchEnd;
        }
      }
    }

    // 3. Verificar sobreposição com agendamentos existentes para ESTE BARBEIRO
    if (!isBlocked) {
      // Só verifica agendamentos se não estiver bloqueado pelo almoço
      for (const existingBooking of existingBookings) {
        const bookingStart = startOfMinute(existingBooking.date); // Normaliza o início do booking do DB
        const bookingEnd = startOfMinute(
          addMinutes(bookingStart, existingBooking.service.durationInMinutes),
        ); // Normaliza o fim do booking do DB

        // Checa se o slot potencial colide com um agendamento existente
        const collision =
          (isBefore(currentTime, bookingEnd) &&
            isAfter(potentialSlotEnd, bookingStart)) ||
          isEqual(currentTime, bookingStart) ||
          isEqual(potentialSlotEnd, bookingEnd);

        if (collision) {
          isBlocked = true;
          // Se há colisão, o próximo ponto de verificação deve ser APÓS o agendamento existente
          nextPotentialAdvanceTime = bookingEnd;
          break;
        }
      }
    }

    // 4. Decidir o que fazer: adicionar slot ou avançar o tempo
    if (!isBlocked) {
      availableSlots.push(format(currentTime, "HH:mm"));
      currentTime = nextPotentialAdvanceTime; // Avança pelo service.durationInMinutes
    } else {
      // Se o slot estava bloqueado, avança o currentTime para o ponto calculado (fim do almoço/booking)
      currentTime = nextPotentialAdvanceTime;
    }
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
