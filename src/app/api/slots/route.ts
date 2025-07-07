// src/app/api/slots/route.ts

import { getAvailableTimeSlots } from "@/actions/create-booking";
import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

// Força o endpoint a ser sempre dinâmico e nunca usar cache
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Garante que a execução desta função não seja cacheada
  noStore();

  try {
    const { searchParams } = new URL(request.url);

    const barbershopId = searchParams.get("barbershopId");
    const date = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");
    const barberId = searchParams.get("barberId");

    if (!barbershopId || !date || !serviceId || !barberId) {
      return NextResponse.json(
        { error: "Parâmetros ausentes na requisição" },
        { status: 400 },
      );
    }

    const slots = await getAvailableTimeSlots(
      barbershopId,
      new Date(date),
      serviceId,
      barberId,
    );

    return NextResponse.json(slots);
  } catch (error) {
    console.error("[API_SLOTS_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar horários" },
      { status: 500 },
    );
  }
}
