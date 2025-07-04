"use server";
import { db } from "@/lib/prisma";
import { User } from "../../generated/prisma";

// Defina o tipo BarberWithUser aqui ou importe de um arquivo de tipos
export type BarberWithUser = {
  id: string;
  userId: string;
  barbershopId: string;
  user: User; // Espera o objeto User completo
};

export async function getBarbersByBarbershop(
  barbershopId: string,
): Promise<BarberWithUser[]> {
  if (!barbershopId) return [];

  const barbers = await db.barber.findMany({
    where: { barbershopId }, // ✅ CORREÇÃO: Use `include: { user: true }` para buscar o objeto de usuário completo.
    // Isto vai resolver o erro de tipo.
    include: {
      user: true,
    },
  }); // JSON.parse(JSON.stringify(...)) é uma boa prática para evitar erros de serialização

  return JSON.parse(JSON.stringify(barbers));
}
