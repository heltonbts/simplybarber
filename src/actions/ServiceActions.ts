"use server";

import { db } from "@/lib/prisma";

export const getServicesByBarbershop = async (barbershopId: string) => {
  const services = await db.barbershopService.findMany({
    where: {
      barbershopId,
    },
    orderBy: {
      name: "asc",
    },
  });

  return services;
};
