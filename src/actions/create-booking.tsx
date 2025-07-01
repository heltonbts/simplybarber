"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "../../generated/prisma";
import { sendExternalMessage } from "./send-external-message";

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
    user: {
      select: {
        phone: true;
        name: true;
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
        user: {
          select: {
            phone: true,
            name: true,
          },
        },
      },
    });

    if (booking.user?.phone) {
      const userPhoneNumber = booking.user.phone;
      const serviceName = booking.service.name;
      const barbershopName = booking.barbershop.name;
      const formattedBookingDate = booking.date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // === AQUI: Construindo a mensagem e chamando sendExternalMessage de forma simples ===
      const messageToSend = `Agendamento Confirmado. Você marcou um ${serviceName} em ${barbershopName} na data de ${formattedBookingDate}.`;

      await sendExternalMessage({
        to: userPhoneNumber,
        message: messageToSend,
      });
    } else {
      console.warn(
        `Usuário ${userIdFromSession} não possui telefone para envio de mensagem de confirmação.`,
      );
    }

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
