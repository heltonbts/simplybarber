import Header from "@/components/header";
import Image from "next/image";
import { db } from "@/lib/prisma";
import BarbershopItem from "@/components/barbershop-item";
import QuickSearch from "@/components/quickSeach";
import Booking from "@/components/booking";
import UserNameAndData from "@/components/name-user";
import SearchItems from "@/components/searchItems";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const barbershops = await db.barbershop.findMany({});
  const popularBarbershops = await db.barbershop.findMany({
    orderBy: {
      name: "desc",
    },
  });

  const bookings = session?.user
    ? await db.booking.findMany({
        where: {
          userId: session?.user.id,
        },
        include: {
          service: {
            include: {
              barbershop: true,
            },
          },
        },
      })
    : [];

  const confirmedBoking = bookings.filter(
    (booking) => booking.date >= new Date(),
  );

  return (
    <div>
      <Header />
      <div className="p-5">
        <UserNameAndData />

        <div className="mt-4">
          <SearchItems />
        </div>
        <QuickSearch />

        <div className="relative w-full h-[150px] mt-6">
          <Image
            src="/banner-01.png"
            fill
            alt="Banner"
            className="object-cover rounded-xl"
          />
        </div>
        <h2 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-400">
          Próximos Agendamentos
        </h2>

        {confirmedBoking.length > 0 ? (
          <div className="px-6">
            <Carousel className="w-full max-w-xs">
              <CarouselContent>
                {confirmedBoking.map((booking) => (
                  <CarouselItem key={booking.id} className="w-full">
                    <Booking booking={booking} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        ) : (
          <div className="px-6">
            <p className="text-sm text-gray-600">
              Nenhum agendamento encontrado. Reserve seu horário com poucos
              cliques e evite filas.
            </p>
          </div>
        )}

        <h2 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-400">
          recomendados
        </h2>
        <div className="flex gap-4 overflow-auto [&::-webkit-scrollbar]:hidden">
          {barbershops.map((barbershop) => (
            <BarbershopItem key={barbershop.id} barbershop={barbershop} />
          ))}
        </div>

        <h2 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-400">
          Populares
        </h2>
        <div className="flex gap-4 overflow-auto [&::-webkit-scrollbar]:hidden">
          {popularBarbershops.map((barbershop) => (
            <BarbershopItem key={barbershop.id} barbershop={barbershop} />
          ))}
        </div>
      </div>
    </div>
  );
}
