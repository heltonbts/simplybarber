"use server";

import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface createBookingParams {
  serviceId: string;
  date: Date;
  barbershopId?: string;
}
export const createBooking = async ({
  serviceId,
  date,
  barbershopId,
}: createBookingParams) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Acesso negado. Usuário não autenticado.");
  }

  const userIdFromSession = session.user.id;

  const booking = await db.booking.create({
    data: {
      userId: userIdFromSession,
      serviceId,
      date,
      barbershopId,
    },
  });

  return booking;
};
