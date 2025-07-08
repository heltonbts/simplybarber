// src/app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createBookingAction } from "@/actions/create-booking";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      barbershopId,
      barberId,
      serviceId,
      userId,
      selectedDate,
      selectedTime,
    } = body;

    if (
      !barbershopId ||
      !barberId ||
      !serviceId ||
      !userId ||
      !selectedDate ||
      !selectedTime
    ) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios ausentes" },
        { status: 400 },
      );
    }

    const result = await createBookingAction(
      barbershopId,
      barberId,
      serviceId,
      userId,
      selectedDate,
      selectedTime,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    revalidatePath(`/barbershop/${barbershopId}`);
    return NextResponse.json({ booking: result.booking }, { status: 200 });
  } catch (error) {
    console.error("Erro interno ao criar agendamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
