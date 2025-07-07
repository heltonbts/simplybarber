// actions/booking-actions.ts
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

import {
  Prisma,
  Booking,
  BarbershopService,
  User,
} from "../../generated/prisma";

import { formatInTimeZone, toZonedTime } from "date-fns-tz";
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

const timeZone = "America/Sao_Paulo";

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
  return await db.$transaction(async (tx) => {
    const service = await tx.barbershopService.findUnique({
      where: { id: serviceId },
      select: { durationInMinutes: true },
    });
    if (!service) return [];

    // Converte a data recebida (UTC) para o fuso da barbearia
    const selectedZonedDate = toZonedTime(selectedDate, timeZone);

    const weekDay = getDay(selectedZonedDate);
    const barbershopWorkingHour = await tx.barbershopWorkingHour.findUnique({
      where: { barbershopId_weekDay: { barbershopId, weekDay } },
    });
    if (!barbershopWorkingHour?.isOpen) return [];

    // --- CORREÇÃO PRINCIPAL AQUI ---
    // Pega o início e o fim do dia NO FUSO HORÁRIO CORRETO
    const start = startOfDay(selectedZonedDate);
    const end = endOfDay(selectedZonedDate);

    // A query agora usa esses objetos Date diretamente.
    // O Prisma/JS os converterá para o timestamp UTC correto.
    const existingBookings = await tx.booking.findMany({
      where: {
        barberId,
        barbershopId,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: { service: { select: { durationInMinutes: true } } },
    });
    // --- FIM DA CORREÇÃO ---

    // O restante da lógica para gerar os slots já estava usando a `selectedZonedDate`
    // e pode continuar praticamente igual.
    const [openHour, openMinute] = barbershopWorkingHour.openTime
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = barbershopWorkingHour.closeTime
      .split(":")
      .map(Number);

    const startOfWorkDay = setMinutes(
      setHours(selectedZonedDate, openHour),
      openMinute,
    );
    const endOfWorkDay = setMinutes(
      setHours(selectedZonedDate, closeHour),
      closeMinute,
    );

    const lunchStart = barbershopWorkingHour.lunchStart
      ? setMinutes(
          setHours(
            selectedZonedDate,
            Number(barbershopWorkingHour.lunchStart.split(":")[0]),
          ),
          Number(barbershopWorkingHour.lunchStart.split(":")[1]),
        )
      : null;
    const lunchEnd = barbershopWorkingHour.lunchEnd
      ? setMinutes(
          setHours(
            selectedZonedDate,
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
    const session = await getServerSession(authOptions);
    const bookingDate = new Date(date);

    // Validações...
    if (isNaN(bookingDate.getTime()))
      return { success: false, error: "Data inválida." };

    // --- LEITURA ÚNICA E VALIDACÃO ---
    const availableSlotsBeforeBooking = await getAvailableTimeSlots(
      barbershopId,
      bookingDate, // Passa a data UTC, a função interna irá converter
      serviceId,
      barberId,
    );

    // Formata o tempo solicitado no FUSO HORÁRIO CORRETO para validação
    const requestedTime = formatInTimeZone(bookingDate, timeZone, "HH:mm");

    if (!availableSlotsBeforeBooking.includes(requestedTime)) {
      console.log(
        "❌ Debug - Horário não disponível na validação:",
        requestedTime,
      );
      return {
        success: false,
        error:
          "Horário não disponível. Alguém pode ter agendado. Por favor, escolha outro.",
      };
    }

    // --- ESCRITA NO BANCO ---
    const booking = await db.booking.create({
      data: {
        userId: session?.user?.id,
        serviceId,
        date: bookingDate, // Salva a data como UTC no banco, o que é a prática correta
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

    // --- MANIPULAÇÃO EM MEMÓRIA ---
    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== requestedTime,
    );

    revalidatePath(`/barbershops/${barbershopId}`);
    // ... outros revalidatePath ...

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
