// /app/api/bookings/route.ts - VERSÃO FINAL E CORRETA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Importe as funções que vamos usar para a validação
import {
  getAvailableTimeSlots,
  createBookingAction,
} from "@/actions/create-booking";
import { createBrazilDateFromString } from "@/lib/timezone-utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
      });
    }

    const body = await req.json();
    const { barbershopId, barberId, serviceId, selectedDate, selectedTime } =
      body;

    if (
      !barbershopId ||
      !barberId ||
      !serviceId ||
      !selectedDate ||
      !selectedTime
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Campos obrigatórios faltando" }),
        { status: 400 },
      );
    }

    // --- INÍCIO DA VALIDAÇÃO EM TEMPO REAL ---

    // 1. Buscamos os horários disponíveis no exato momento do clique, usando as funções que já corrigimos.
    const dateObj = createBrazilDateFromString(selectedDate);
    const availableSlots = await getAvailableTimeSlots(
      barbershopId,
      dateObj,
      serviceId,
      barberId,
    );

    // 2. Verificamos se o horário que o usuário quer ainda está na lista de disponíveis.
    const isSlotStillAvailable = availableSlots.includes(selectedTime);

    // 3. Se o horário NÃO estiver mais disponível, paramos aqui e retornamos um erro.
    if (!isSlotStillAvailable) {
      console.error(
        `VALIDAÇÃO FALHOU: O horário ${selectedTime} não está na lista de horários disponíveis.`,
      );
      return new NextResponse(
        JSON.stringify({
          error:
            "Este horário foi agendado por outra pessoa. Por favor, escolha outro.",
        }),
        { status: 409 }, // 409 Conflict
      );
    }
    // --- FIM DA VALIDAÇÃO ---

    // 4. Se o horário PASSOU na validação, aí sim chamamos a sua createBookingAction.
    console.log(`Validação OK. Criando agendamento para ${selectedTime}...`);
    const booking = await createBookingAction(
      barbershopId,
      barberId,
      serviceId,
      session.user.id,
      selectedDate,
      selectedTime,
    );

    // Retorna 201 Created (sucesso)
    return new NextResponse(JSON.stringify(booking), { status: 201 });
  } catch (error) {
    console.error("❌ Erro na API /api/bookings:", error);
    return new NextResponse(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Erro interno do servidor",
      }),
      { status: 500 },
    );
  }
}
