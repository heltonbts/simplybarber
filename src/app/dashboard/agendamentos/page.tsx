import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getBarbersByBarbershop } from "@/actions/barber-actions"; // Assumindo que você tem este arquivo
import { getServicesByBarbershop } from "@/actions/ServiceActions"; // Assumindo que você tem este arquivo
import { getBookingsByBarbershop } from "@/actions/create-booking";
import { BookingManagementClient } from "@/components/dashboard/booking-management-client";
import { buttonVariants } from "@/components/ui/button";

export default async function BookingManagementPage() {
  const session = await getServerSession(authOptions); // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!session?.user || !(session.user as any).id) {
    redirect("/");
  }

  const barbershop = await db.barbershop.findFirst({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { ownerId: (session.user as any).id },
  });

  if (!barbershop) {
    return <p className="p-6">Barbearia não encontrada.</p>;
  }

  const [barbers, services, bookings] = await Promise.all([
    getBarbersByBarbershop(barbershop.id),
    getServicesByBarbershop(barbershop.id),
    getBookingsByBarbershop(barbershop.id),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
           {" "}
      <div className="mb-6">
               {" "}
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
                    <ChevronLeft className="h-4 w-4 mr-2" />          Voltar ao
          Painel        {" "}
        </Link>
             {" "}
      </div>
           {" "}
      <BookingManagementClient
        barbershopId={barbershop.id}
        initialBookings={bookings}
        barbers={barbers}
        services={services}
      />
         {" "}
    </div>
  );
}
