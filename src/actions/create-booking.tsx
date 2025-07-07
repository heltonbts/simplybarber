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
  differenceInMinutes,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import {
  Prisma,
  Booking,
  BarbershopService,
  User,
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

  return await db.$transaction(async (tx) => {
    // A primeira parte da função continua a mesma...
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
      where: { barberId, barbershopId, date: { gte: start, lt: end } },
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
    const nowInZone = toZonedTime(new Date(), timeZone);
    const potentialSlots: Date[] = [];
    let currentTime = startOfWorkDay;
    while (isBefore(currentTime, endOfWorkDay)) {
      potentialSlots.push(currentTime);
      currentTime = addMinutes(currentTime, 15);
    }

    // O filtro agora terá um log detalhado
    const availableSlots = potentialSlots.filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, service.durationInMinutes);

      if (isAfter(slotEnd, endOfWorkDay)) return false;
      if (isBefore(slotStart, nowInZone)) return false;
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
      if (
        lunchStart &&
        lunchEnd &&
        isBefore(slotStart, lunchEnd) &&
        isAfter(slotEnd, lunchStart)
      )
        return false;

      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = toZonedTime(booking.date, timeZone);
        const bookingDuration = booking.service.durationInMinutes;
        const bookingEnd = addMinutes(bookingStart, bookingDuration);

        const conflict =
          isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart);

        // --- LOG DE DEPURAÇÃO ADICIONADO ---
        // Loga apenas os cálculos para slots que estão a menos de 90 min de um agendamento existente
        if (Math.abs(differenceInMinutes(slotStart, bookingStart)) < 90) {
          console.log({
            "--- Checando Conflito ---": "---",
            "Slot em verificação": formatInTimeZone(
              slotStart,
              timeZone,
              "HH:mm",
            ),
            "Fim do novo serviço seria": formatInTimeZone(
              slotEnd,
              timeZone,
              "HH:mm",
            ),
            "------------------": "---",
            "Agendamento existente começa": formatInTimeZone(
              bookingStart,
              timeZone,
              "HH:mm",
            ),
            "Duração do agendamento existente (min)": bookingDuration,
            "Fim calculado do agendamento existente": formatInTimeZone(
              bookingEnd,
              timeZone,
              "HH:mm",
            ),
            "------------------ (2)": "---",
            "Resultado do Conflito": conflict,
          });
        }
        // --- FIM DO LOG ---

        return conflict;
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
  noStore();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: "Acesso não autorizado." };
    }

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

    const newAvailableSlots = availableSlotsBeforeBooking.filter(
      (slot) => slot !== requestedTime,
    );

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/dashboard/agendamentos");
    if (session.user.id) {
      revalidatePath("/meus-agendamentos");
    }

    return { success: true, booking, newAvailableSlots };
  } catch (error: unknown) {
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
