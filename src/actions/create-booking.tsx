"use server";

import { db } from "@/lib/prisma";

interface createBookingParams {
  serviceId: string;
  userId: string;
  date: Date;
  barbershopId?: string;
}

export const createBooking = async ({
  userId,
  serviceId,
  date,
  barbershopId,
}: createBookingParams) => {
  await db.booking.create({
    data: {
      userId,
      serviceId,
      date,
      barbershopId,
    },
  });
};
