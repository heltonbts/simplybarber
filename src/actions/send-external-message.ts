"use server";

interface SendMessageParams {
  to: string;
  message: string;
}

export async function sendExternalMessage({ to, message }: SendMessageParams) {
  if (!to || !message) {
    console.error(
      "Erro: Destinatário ou mensagem não fornecidos para sendExternalMessage.",
    );
    return { success: false, error: "Destinatário ou mensagem ausentes." };
  }

  const externalApiUrl = "http://137.131.252.244:3000/enviar-mensagem";

  const requestBody = {
    to: to,
    message: message,
  };

  (async () => {
    try {
      console.log(
        `Iniciando envio de mensagem para ${to} via API externa customizada...`,
      );
      console.log("Dados a serem enviados:", requestBody);

      const response = await fetch(externalApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Falha no envio da mensagem via API externa customizada para ${to}: Status ${response.status}`,
          errorText,
        );
      } else {
        console.log(
          `Mensagem enviada com sucesso para ${to} via API externa customizada. Resposta:`,
          await response.text(),
        );
      }
    } catch (networkError: unknown) {
      let errorMessage =
        "Ocorreu um erro desconhecido ao enviar mensagem para API externa.";
      if (networkError instanceof Error) {
        errorMessage = networkError.message;
      } else if (typeof networkError === "string") {
        errorMessage = networkError;
      }
      console.error(
        `Erro inesperado ao enviar mensagem para API externa customizada para ${to}:`,
        errorMessage,
      );
    }
  })();

  return {
    success: true,
    message:
      "Mensagem de notificação iniciada em segundo plano via API customizada.",
  };
}
