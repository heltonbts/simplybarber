"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export async function uploadImage(formData: FormData) {
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("Nenhum arquivo de imagem foi enviado.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("O arquivo enviado não é uma imagem válida.");
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `O arquivo é muito grande. Tamanho máximo permitido: ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    );
  }

  try {
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
    });

    revalidatePath("/dashboard/servicos");

    console.log(`Imagem "${file.name}" uploaded com sucesso. URL: ${blob.url}`);
    return { success: true, imageUrl: blob.url };
  } catch (error) {
    console.error("Erro ao fazer upload da imagem para o Vercel Blob:", error);
    throw new Error(
      "Falha ao fazer upload da imagem. Por favor, tente novamente.",
    );
  }
}
