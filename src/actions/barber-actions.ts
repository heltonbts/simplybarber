"use server";

import { db } from "@/lib/prisma";

export const getBarbersByBarbershop = async (barbershopId: string) => {
  const barbers = await db.barber.findMany({
    where: {
      barbershopId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return barbers;
};
