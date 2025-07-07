"use server";

interface SendMessageParams {
  to: string;
  message: string;
}

// Recomenda-se usar variáveis de ambiente para a URL da API
const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || "http://137.131.252.244:3000/enviar-mensagem";

export async function sendExternalMessage({ to, message }: SendMessageParams) {
  if (!to || !message) {
    console.error("Erro: Destinatário ou mensagem não fornecidos.");
    return { success: false, error: "Destinatário ou mensagem ausentes." };
  }

  const requestBody = { to, message };

  console.log(`Iniciando envio para ${to} via API...`);
  console.log("Dados a serem enviados:", requestBody);

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      // Adiciona um cache 'no-store' para garantir que a requisição seja sempre nova
      cache: "no-store",
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(
        `Falha no envio para ${to}: Status ${response.status}`,
        responseBody,
      );
      return {
        success: false,
        error: responseBody.message || "Erro da API externa.",
      };
    }

    console.log(
      `Mensagem enviada com sucesso para ${to}. Resposta:`,
      responseBody,
    );
    return { success: true, data: responseBody };
  } catch (error) {
    console.error(`Erro de rede ao chamar a API para ${to}:`, error);
    // Verifica se 'error' é um objeto de erro para extrair a mensagem
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro de conexão com a API de mensagens.";
    return { success: false, error: errorMessage };
  }
}
