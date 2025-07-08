// /app/api/slots/route.ts

import { NextRequest } from "next/server";
import { getAvailableTimeSlots } from "@/actions/create-booking";
import { unstable_noStore as noStore } from "next/cache";

export const runtime = "nodejs";
export const revalidate = 0;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  noStore();

  const searchParams = req.nextUrl.searchParams;
  const barbershopId = searchParams.get("barbershopId");
  const serviceId = searchParams.get("serviceId");
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barbershopId || !serviceId || !barberId || !date) {
    return new Response("Missing params", { status: 400 });
  }

  const dateObj = new Date(`${date}T00:00:00`);

  const slots = await getAvailableTimeSlots(
    barbershopId,
    dateObj,
    serviceId,
    barberId,
  );

  return Response.json({ slots, timestamp: new Date().toISOString() });
}
