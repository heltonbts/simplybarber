"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "../../generated/prisma";

interface CreateBookingParams {
  serviceId: string;
  date: Date;
  barbershopId: string;
}

type BookingWithDetails = Prisma.BookingGetPayload<{
  include: {
    service: {
      select: {
        name: true;
        price: true;
      };
    };
    barbershop: {
      select: {
        name: true;
        address: true;
      };
    };
  };
}>;

interface CreateBookingResponse {
  success: boolean;
  booking?: BookingWithDetails;
  error?: string;
}

export const createBooking = async ({
  serviceId,
  date,
  barbershopId,
}: CreateBookingParams): Promise<CreateBookingResponse> => {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Acesso negado. Usuário não autenticado.",
      };
    }

    if (!serviceId || !date || !barbershopId) {
      return {
        success: false,
        error: "Dados inválidos para realizar o agendamento.",
      };
    }

    if (new Date(date) < new Date()) {
      return {
        success: false,
        error: "Não é possível agendar para uma data no passado.",
      };
    }

    const userIdFromSession = session.user.id;

    const service = await db.barbershopService.findFirst({
      where: {
        id: serviceId,
        barbershopId: barbershopId,
      },
      include: {
        barbershop: true,
      },
    });

    if (!service) {
      return {
        success: false,
        error: "Serviço não encontrado ou não pertence a esta barbearia.",
      };
    }

    if (!service.barbershop) {
      return {
        success: false,
        error: "Barbearia não encontrada.",
      };
    }

    const existingBooking = await db.booking.findFirst({
      where: {
        serviceId,
        date,
      },
    });

    if (existingBooking) {
      return {
        success: false,
        error: "Este horário já está ocupado.",
      };
    }

    // Criar o agendamento
    const booking = await db.booking.create({
      data: {
        userId: userIdFromSession,
        serviceId,
        date,
        barbershopId,
      },
      include: {
        service: {
          select: {
            name: true,
            price: true,
          },
        },
        barbershop: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    revalidatePath(`/barbershops/${barbershopId}`);
    revalidatePath("/bookings");

    return {
      success: true,
      booking,
    };
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return {
      success: false,
      error: "Erro interno do servidor. Tente novamente mais tarde.",
    };
  }
};
