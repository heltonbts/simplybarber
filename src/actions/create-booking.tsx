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
    // Validações iniciais (continuam iguais)
    const session = await getServerSession(authOptions);
    // ... toda a sua lógica de validação de sessão, dados, data, etc. ...
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return { success: false, error: "Data inválida." };
    }

    // --- PASSO 1: BUSCAR HORÁRIOS DISPONÍVEIS (ÚNICA LEITURA DO BANCO) ---
    const availableSlotsBeforeBooking = await getAvailableTimeSlots(
      barbershopId,
      bookingDate,
      serviceId,
      barberId,
    );

    // --- PASSO 2: VALIDAR O HORÁRIO SOLICITADO ---
    const requestedTime = format(bookingDate, "HH:mm");
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

    console.log("🔍 Debug - Horário disponível, criando booking...");

    // --- PASSO 3: CRIAR O AGENDAMENTO (ESCRITA NO BANCO) ---
    const booking = await db.booking.create({
      data: {
        userId: session?.user?.id, // Simplificado, assumindo que a validação anterior já cuidou disso
        serviceId,
        date: bookingDate,
        barbershopId,
        barberId,
        clientName,
        clientPhone,
        notes,
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

    console.log("✅ Debug - Booking criado com sucesso:", { id: booking.id });

    // --- PASSO 4: CRIAR A NOVA LISTA DE HORÁRIOS EM MEMÓRIA (SEM LER O BANCO NOVAMENTE) ---
    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== requestedTime,
    );

    // ... seu código de envio de mensagem ...

    // --- PASSO 5: REVALIDAR PATHS E RETORNAR A LISTA CORRETA E ATUALIZADA ---
    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (session?.user?.id) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking, newAvailableSlots };
  } catch (error: unknown) {
    // seu bloco catch continua o mesmo
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
