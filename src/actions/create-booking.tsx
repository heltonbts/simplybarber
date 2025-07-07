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

// Tipo completo para agendamento, usado na tabela de gerenciamento
export type BookingDetails = Booking & {
  service: BarbershopService;
  barber: BarberWithUser;
  user?: User | null; // IMPORTANTE: Adicionar o user aqui
};

// READ: Função para buscar todos os agendamentos da barbearia para a tabela - CORRIGIDA
export async function getBookingsByBarbershop(
  barbershopId: string,
): Promise<BookingDetails[]> {
  console.log("🔍 Debug - Buscando bookings para barbershop:", barbershopId);

  if (!barbershopId) return [];

  const bookings = await db.booking.findMany({
    where: { barbershopId },
    include: {
      service: true,
      barber: { include: { user: true } },
      user: true, // IMPORTANTE: Incluir o user relacionado
    },
    orderBy: { date: "desc" },
  });

  console.log("🔍 Debug - Bookings encontrados:", bookings.length);

  // Debug detalhado de cada booking
  bookings.forEach((booking, index) => {
    console.log(`🔍 Debug - Booking ${index + 1}:`, {
      id: booking.id,
      date: booking.date,
      userId: booking.userId,
      userName: booking.user?.name,
      clientName: booking.clientName,
      serviceName: booking.service.name,
      barberName: booking.barber.user.name,
      finalDisplayName:
        booking.clientName || booking.user?.name || "Cliente não informado",
    });
  });

  const plainBookings = bookings.map((booking) => ({
    ...booking,
    service: {
      ...booking.service,
      price: Number(booking.service.price),
    },
  }));

  return JSON.parse(JSON.stringify(plainBookings));
}

// UPDATE: Função para atualizar um agendamento existente
export interface UpdateBookingInput extends CreateBookingInput {
  bookingId: string;
}

export async function updateBooking(payload: UpdateBookingInput) {
  const session = await getServerSession(authOptions);
  const { bookingId, ...data } = payload;

  console.log("🔍 Debug - Atualizando booking:", bookingId, data);
  console.log("🔍 Debug - Sessão:", session?.user?.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session?.user || !(session.user as any).id) {
    throw new Error("Acesso não autorizado.");
  }
  if (!bookingId) {
    throw new Error("ID do agendamento é obrigatório para atualização.");
  }

  const bookingToUpdate = await db.booking.findUnique({
    where: { id: bookingId },
    select: { barbershop: { select: { ownerId: true } } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (bookingToUpdate?.barbershop.ownerId !== (session.user as any).id) {
    throw new Error("Você não tem permissão para editar este agendamento.");
  }

  const updatedBooking = await db.booking.update({
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

  console.log("✅ Debug - Booking atualizado:", updatedBooking.id);

  revalidatePath("/dashboard/agendamentos");
}

export async function getAvailableTimeSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  // Use uma transaction para garantir que você obtenha os dados mais recentes,
  // o que pode ajudar a mitigar problemas de latência na replicação.
  return await db.$transaction(async (tx) => {
    const validatedDate = startOfMinute(new Date(selectedDate));

    // 1. BUSCAR TODOS OS DADOS NECESSÁRIOS
    const service = await tx.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });

    if (!service) return [];

    const barbershopWorkingHour = await tx.barbershopWorkingHour.findUnique({
      where: {
        barbershopId_weekDay: { barbershopId, weekDay: getDay(validatedDate) },
      },
    });

    if (!barbershopWorkingHour?.isOpen) return [];

    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: {
          gte: setHours(validatedDate, 0), // Pega todos os agendamentos para o dia inteiro
          lt: setHours(validatedDate, 24),
        },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });

    // 2. DEFINIR HORÁRIO DE FUNCIONAMENTO E ALMOÇO
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

    const now = startOfMinute(new Date());

    // 3. GERAR TODOS OS HORÁRIOS POTENCIAIS
    const potentialSlots: Date[] = [];
    let currentTime = startOfWorkDay;
    const slotInterval = 15; // Define um intervalo fixo para os horários potenciais (ex: 15 minutos)

    while (isBefore(currentTime, endOfWorkDay)) {
      potentialSlots.push(currentTime);
      currentTime = addMinutes(currentTime, slotInterval);
    }

    // 4. FILTRAR PARA ENCONTRAR OS HORÁRIOS DISPONÍVEIS
    const availableSlots = potentialSlots.filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, service.durationInMinutes);

      // Regra 1: O horário não pode ser no passado
      if (isBefore(slotStart, now)) return false;

      // Regra 2: O horário não pode terminar após o fechamento
      if (isAfter(slotEnd, endOfWorkDay)) return false;

      // Regra 3: O horário não pode conflitar com o almoço
      if (lunchStart && lunchEnd) {
        if (isBefore(slotStart, lunchEnd) && isAfter(slotEnd, lunchStart)) {
          return false;
        }
      }

      // Regra 4: O horário não pode conflitar com agendamentos existentes
      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = startOfMinute(booking.date);
        const bookingEnd = addMinutes(
          bookingStart,
          booking.service.durationInMinutes,
        );

        // Verifica qualquer sobreposição entre [slotStart, slotEnd] e [bookingStart, bookingEnd]
        return (
          isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart)
        );
      });

      if (hasConflict) return false;

      // Se passar em todas as checagens, o horário está disponível
      return true;
    });

    return availableSlots.map((date) => format(date, "HH:mm"));
  });
}

// Função auxiliar para usar no frontend após criar agendamento
export async function refreshAvailableSlots(
  barbershopId: string,
  selectedDate: Date,
  serviceId: string,
  barberId: string,
): Promise<string[]> {
  // Aguarda um pouco mais para garantir que o agendamento foi salvo
  await new Promise((resolve) => setTimeout(resolve, 500));

  return getAvailableTimeSlots(barbershopId, selectedDate, serviceId, barberId);
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
    console.log("🔍 Debug - Iniciando criação de booking com dados:", {
      serviceId,
      date,
      barbershopId,
      barberId,
      clientName,
      clientPhone,
      notes,
    });

    const session = await getServerSession(authOptions);
    console.log("🔍 Debug - Sessão encontrada:", {
      userId: session?.user?.id,
      userName: session?.user?.name,
      userEmail: session?.user?.email,
    });

    let bookingUserId: string | null = null;

    if (session?.user?.id) {
      bookingUserId = session.user.id;
      console.log("🔍 Debug - Usando userId da sessão:", bookingUserId);
    } else {
      if (!clientName || clientName.trim().length === 0) {
        console.log("❌ Debug - Sem usuário logado e sem clientName");
        return {
          success: false,
          error:
            "Para agendamentos sem login, o nome do cliente é obrigatório.",
        };
      }
      console.log(
        "🔍 Debug - Agendamento sem usuário logado, usando clientName:",
        clientName,
      );
    }

    if (!serviceId || !date || !barbershopId || !barberId) {
      console.log("❌ Debug - Dados incompletos:", {
        serviceId,
        date,
        barbershopId,
        barberId,
      });
      return {
        success: false,
        error:
          "Dados de agendamento incompletos (serviço, data, barbearia ou barbeiro faltando).",
      };
    }

    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      console.log("❌ Debug - Data inválida:", date);
      return {
        success: false,
        error: "Data ou hora do agendamento inválidas.",
      };
    }

    if (bookingDate < new Date()) {
      console.log("❌ Debug - Data no passado:", bookingDate);
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
      console.log("❌ Debug - Serviço não encontrado:", serviceId);
      return { success: false, error: "Serviço não encontrado." };
    }

    console.log("🔍 Debug - Serviço encontrado:", service.name);

    const availableSlotsAtCreateTime = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    const requestedTime = format(bookingDate, "HH:mm");
    if (!availableSlotsAtCreateTime.includes(requestedTime)) {
      console.log("❌ Debug - Horário não disponível:", requestedTime);
      return {
        success: false,
        error:
          "Horário não disponível. Alguém pode ter agendado. Por favor, escolha outro horário ou barbeiro.",
      };
    }

    console.log("🔍 Debug - Horário disponível, criando booking...");

    const bookingData = {
      userId: bookingUserId,
      serviceId,
      date: bookingDate,
      barbershopId,
      barberId,
      clientName: clientName,
      clientPhone: clientPhone,
      notes: notes,
    };

    console.log("🔍 Debug - Dados do booking a serem salvos:", bookingData);

    const booking = await db.booking.create({
      data: bookingData,
      include: {
        service: {
          select: { name: true, price: true, durationInMinutes: true },
        },
        barbershop: { select: { name: true, address: true } },
        user: { select: { phone: true, name: true } },
        barber: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    console.log("✅ Debug - Booking criado com sucesso:", {
      id: booking.id,
      userId: booking.userId,
      userName: booking.user?.name,
      clientName: booking.clientName,
      date: booking.date,
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
        to: booking.user.phone,
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

    const newAvailableSlots = await getAvailableTimeSlots(
      barbershopId,
      date, // A data do agendamento
      serviceId,
      barberId,
    );

    // Revalidar paths
    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (bookingUserId) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking, newAvailableSlots };
  } catch (error: unknown) {
    console.error("❌ Erro ao criar agendamento:", error);
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
  console.log("🔍 Debug - Deletando booking:", bookingId);

  const session = await getServerSession(authOptions);
  console.log("🔍 Debug - Sessão para delete:", session?.user?.id);

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

  console.log("🔍 Debug - Booking a ser deletado:", {
    ownerId: bookingToDelete.barbershop.ownerId,
    userId: bookingToDelete.userId,
    sessionUserId: session.user.id,
  });

  const isOwner = bookingToDelete.barbershop.ownerId === session.user.id;
  const isClient = bookingToDelete.userId === session.user.id;

  if (!isOwner && !isClient) {
    throw new Error("Você não tem permissão para excluir este agendamento.");
  }

  try {
    await db.booking.delete({
      where: { id: bookingId },
    });

    console.log("✅ Debug - Booking deletado com sucesso:", bookingId);

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
