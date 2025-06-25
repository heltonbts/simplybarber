import BarbershopItem from "@/components/barbershop-item";
import Header from "@/components/header";
import SearchItems from "@/components/searchItems";
import { db } from "@/lib/prisma";

interface BarbershopsProp {
  searchParams?: { search?: string };
}

const BarbershopsPage = async ({ searchParams }: BarbershopsProp) => {
  const barbershop = await db.barbershop.findMany({
    where: searchParams?.search
      ? {
          name: {
            contains: searchParams.search,
            mode: "insensitive",
          },
        }
      : {},
  });

  return (
    <div>
      <Header />
      <div className="mt-4 px-5">
        <SearchItems />
      </div>
      <div className="px-5">
        <h1 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
          Resultados Para &quot;{searchParams?.search ?? ""}&quot;
        </h1>
        <div className="grid grid-cols-2 gap-4 my-4">
          {barbershop.map((barbershop) => (
            <BarbershopItem key={barbershop.id} barbershop={barbershop} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BarbershopsPage;
