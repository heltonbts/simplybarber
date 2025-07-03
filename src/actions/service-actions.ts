"use server";

import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

type ServiceInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  durationInMinutes: number;
};

export async function createBarbershopService(data: Omit<ServiceInput, "id">) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Usuário não autenticado. Faça login para criar serviços.");
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error(
      "Barbearia não encontrada. Cadastre sua barbearia primeiro.",
    );
  }

  if (!data.name || data.name.trim() === "") {
    throw new Error("O nome do serviço é obrigatório.");
  }
  if (!data.description || data.description.trim() === "") {
    throw new Error("A descrição do serviço é obrigatória.");
  }
  if (typeof data.price !== "number" || data.price <= 0) {
    throw new Error("O preço do serviço deve ser um número positivo.");
  }
  if (
    typeof data.durationInMinutes !== "number" ||
    data.durationInMinutes <= 0
  ) {
    throw new Error(
      "A duração do serviço deve ser um número inteiro positivo (em minutos).",
    );
  }
  if (!data.imageUrl || data.imageUrl.trim() === "") {
    throw new Error("A URL da imagem do serviço é obrigatória.");
  }

  try {
    const newService = await db.barbershopService.create({
      data: {
        barbershopId: barbershop.id,
        name: data.name,
        description: data.description,
        price: new Decimal(data.price),
        imageUrl: data.imageUrl,
        durationInMinutes: data.durationInMinutes,
      },
    });

    revalidatePath("/dashboard/servicos");
    return { success: true, service: newService };
  } catch (error) {
    console.error("Erro ao criar serviço:", error);
    throw new Error(
      "Falha ao criar o serviço. Verifique os dados e tente novamente.",
    );
  }
}

export async function updateBarbershopService(
  serviceId: string,
  data: Omit<ServiceInput, "id">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para atualizar serviços.",
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error("Barbearia não encontrada.");
  }

  const existingService = await db.barbershopService.findUnique({
    where: { id: serviceId },
    select: { barbershopId: true },
  });

  if (!existingService || existingService.barbershopId !== barbershop.id) {
    throw new Error(
      "Serviço não encontrado ou você não tem permissão para editá-lo.",
    );
  }

  if (!data.name || data.name.trim() === "") {
    throw new Error("O nome do serviço é obrigatório.");
  }
  if (!data.description || data.description.trim() === "") {
    throw new Error("A descrição do serviço é obrigatória.");
  }
  if (typeof data.price !== "number" || data.price <= 0) {
    throw new Error("O preço do serviço deve ser um número positivo.");
  }
  if (
    typeof data.durationInMinutes !== "number" ||
    data.durationInMinutes <= 0
  ) {
    throw new Error(
      "A duração do serviço deve ser um número inteiro positivo (em minutos).",
    );
  }
  if (!data.imageUrl || data.imageUrl.trim() === "") {
    throw new Error("A URL da imagem do serviço é obrigatória.");
  }

  try {
    const updatedService = await db.barbershopService.update({
      where: { id: serviceId },
      data: {
        name: data.name,
        description: data.description,
        price: new Decimal(data.price),
        imageUrl: data.imageUrl,
        durationInMinutes: data.durationInMinutes,
      },
    });

    revalidatePath("/dashboard/servicos");
    return { success: true, service: updatedService };
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    throw new Error(
      "Falha ao atualizar o serviço. Verifique os dados e tente novamente.",
    );
  }
}

export async function deleteBarbershopService(serviceId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para excluir serviços.",
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    throw new Error("Barbearia não encontrada.");
  }

  // Primeiro, verifica se o serviço pertence a esta barbearia e ao proprietário
  const existingService = await db.barbershopService.findUnique({
    where: { id: serviceId },
    select: { barbershopId: true },
  });

  if (!existingService || existingService.barbershopId !== barbershop.id) {
    throw new Error(
      "Serviço não encontrado ou você não tem permissão para excluí-lo.",
    );
  }

  try {
    await db.barbershopService.delete({
      where: { id: serviceId },
    });

    revalidatePath("/dashboard/servicos");
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    throw new Error("Falha ao excluir o serviço. Tente novamente.");
  }
}
