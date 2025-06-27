"use server";

import { db } from "@/lib/prisma";
import { endOfDay, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";

interface getBookingProps {
  serviceId: string;
  date: Date;
}

export const getBooking = async ({ date }: getBookingProps) => {
  return await db.booking.findMany({
    where: {
      date: {
        lte: endOfDay(date),
        gte: startOfDay(date),
      },
    },
  });
  revalidatePath("/barbershop/[id]");
};
