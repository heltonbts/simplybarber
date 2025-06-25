import Header from "@/components/header";
import Image from "next/image";
import { db } from "@/lib/prisma";
import BarbershopItem from "@/components/barbershop-item";
import QuickSearch from "@/components/quickSeach";
import Booking from "@/components/booking";
import UserNameAndData from "@/components/name-user";
import SearchItems from "@/components/searchItems";

export default async function Home() {
  const barbershops = await db.barbershop.findMany({});
  const popularBarbershops = await db.barbershop.findMany({
    orderBy: {
      name: "desc",
    },
  });

  return (
    <div>
      <Header />
      <div className="p-5">
        <UserNameAndData />

        <div className="mt-4 px-5">
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

        <Booking />

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
