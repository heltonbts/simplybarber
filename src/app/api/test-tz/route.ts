/* eslint-disable @typescript-eslint/no-explicit-any */
// /app/api/test-tz/route.ts
import { NextResponse } from "next/server";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic"; // Impede que a Vercel use cache nesta rota

export async function GET() {
  const timeZone = "America/Sao_Paulo";
  const nowUtc = new Date();

  try {
    // Teste 1: Converter a hora atual UTC para o fuso de SP
    const formattedSaoPaulo = formatInTimeZone(
      nowUtc,
      timeZone,
      "yyyy-MM-dd HH:mm:ssXXX",
    );

    // Teste 2: Converter uma hora "local" de SP (10 da manhã) para seu valor UTC real
    const wallClockTime = "2025-07-09T10:00:00";
    const utcFromSaoPaulo = fromZonedTime(wallClockTime, timeZone);

    return NextResponse.json({
      ok: true,
      testDescription:
        "Resultado do teste de conversão de fuso horário no ambiente de produção.",
      nodeVersion: process.version,
      nowUtc_ISO: nowUtc.toISOString(),
      formattedSaoPaulo_String: formattedSaoPaulo, // Este é um resultado crucial
      utcFromSaoPaulo_ISO: utcFromSaoPaulo.toISOString(), // Este é outro resultado crucial
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "A conversão de fuso horário falhou.",
        errorMessage: error.message,
      },
      { status: 500 },
    );
  }
}
