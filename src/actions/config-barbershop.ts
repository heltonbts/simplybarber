"use server";

import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

type UpdateBarbershopProfileInput = {
  name: string;
  address: string;
  phone: string[];
  description: string;
  imageUrl: string;
};

export async function updateBarbershopProfile(
  data: UpdateBarbershopProfileInput,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error(
      "Usuário não autenticado. Faça login para atualizar as configurações da barbearia.",
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

  if (!data.name || data.name.trim() === "")
    throw new Error("O nome da barbearia é obrigatório.");
  if (!data.address || data.address.trim() === "")
    throw new Error("O endereço da barbearia é obrigatório.");
  if (!data.description || data.description.trim() === "")
    throw new Error("A descrição da barbearia é obrigatória.");
  if (!data.imageUrl || data.imageUrl.trim() === "")
    throw new Error("A imagem da barbearia é obrigatória.");
  if (!Array.isArray(data.phone))
    throw new Error("O campo telefone deve ser um array de strings.");

  try {
    const updatedBarbershop = await db.barbershop.update({
      where: { id: barbershop.id },
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        description: data.description,
        imageUrl: data.imageUrl,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/barbershop/[id]");

    return { success: true, barbershop: updatedBarbershop };
  } catch (error) {
    console.error("Erro ao salvar configurações da barbearia:", error);
    throw new Error(
      "Falha ao salvar as configurações da barbearia. Verifique os dados e tente novamente.",
    );
  }
}
