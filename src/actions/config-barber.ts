"use server";

import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

export async function addBarber(email: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para adicionar barbeiros.",
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error(
      "Barbearia não encontrada. Por favor, cadastre sua barbearia primeiro.",
    );
  }

  // 1. Encontrar o usuário pelo e-mail
  const userToAdd = await db.user.findUnique({
    where: { email: email },
  });

  if (!userToAdd) {
    throw new Error(
      "Usuário com este e-mail não encontrado. Peça para o barbeiro se cadastrar no sistema primeiro.",
    );
  }

  const existingBarber = await db.barber.findUnique({
    where: {
      userId_barbershopId: {
        // Usa a chave única composta definida no Prisma
        userId: userToAdd.id,
        barbershopId: barbershop.id,
      },
    },
  });

  if (existingBarber) {
    throw new Error("Este usuário já é um barbeiro nesta barbearia.");
  }

  try {
    const newBarber = await db.barber.create({
      data: {
        userId: userToAdd.id,
        barbershopId: barbershop.id,
      },
    });

    revalidatePath("/dashboard/barbers");
    return { success: true, barber: newBarber };
  } catch (error) {
    console.error("Erro ao adicionar barbeiro:", error);
    throw new Error(
      "Falha ao adicionar o barbeiro. Tente novamente ou verifique o e-mail.",
    );
  }
}

export async function removeBarber(barberId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para remover barbeiros.",
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error("Barbearia não encontrada.");
  }

  const barberToRemove = await db.barber.findUnique({
    where: { id: barberId },
    select: { barbershopId: true, userId: true },
  });

  if (!barberToRemove || barberToRemove.barbershopId !== barbershop.id) {
    throw new Error(
      "Barbeiro não encontrado ou você não tem permissão para removê-lo desta barbearia.",
    );
  }

  try {
    await db.barber.delete({
      where: { id: barberId },
    });

    revalidatePath("/dashboard/barbers");
    return { success: true };
  } catch (error) {
    console.error("Erro ao remover barbeiro:", error);
    throw new Error("Falha ao remover o barbeiro. Tente novamente.");
  }
}
