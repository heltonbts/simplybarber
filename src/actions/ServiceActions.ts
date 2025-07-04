"use server";
import { db } from "@/lib/prisma";

export async function getServicesByBarbershop(
  barbershopId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // Usamos 'any' para simplificar, já que vamos modificar a estrutura
  if (!barbershopId) return [];

  const services = await db.barbershopService.findMany({
    where: { barbershopId },
  }); // ✅ CORREÇÃO: Mapeia os resultados para converter Decimal para number

  const plainServices = services.map((service) => ({
    ...service,
    price: Number(service.price),
  }));

  return plainServices;
}
