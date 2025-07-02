// actions/saveWorkingHours.ts
"use server";

import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

type WorkingHourInput = {
  weekDay: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  lunchStart: string | null;
  lunchEnd: string | null;
};

export async function saveWorkingHours(data: WorkingHourInput[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error(
      "Barbearia não encontrada. Por favor, cadastre sua barbearia primeiro.",
    );
  }

  const barbershopId = barbershop.id;

  try {
    // Upsert para cada dia
    await Promise.all(
      data.map((item) =>
        db.barbershopWorkingHour.upsert({
          where: {
            barbershopId_weekDay: {
              barbershopId,
              weekDay: item.weekDay,
            },
          },
          create: {
            ...item,
            barbershopId,
          },
          update: {
            ...item,
          },
        }),
      ),
    );

    revalidatePath("/dashboard/horarios");

    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar horários no banco de dados:", error);
    throw new Error("Ocorreu um erro ao salvar os horários. Tente novamente.");
  }
}
