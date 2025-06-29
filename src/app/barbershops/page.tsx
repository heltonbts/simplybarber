import BarbershopItem from "@/components/barbershop-item";
import Header from "@/components/headers";
import SearchItems from "@/components/searchItems";
import { db } from "@/lib/prisma";

interface BarbershopsProp {
  searchParams?: Promise<{
    title?: string;
    services?: string;
  }>;
}

const BarbershopsPage = async ({ searchParams }: BarbershopsProp) => {
  // Aguarda a resolução dos searchParams
  const resolvedSearchParams = await searchParams;

  const filters = [];

  if (resolvedSearchParams?.title) {
    filters.push({
      name: {
        contains: resolvedSearchParams.title,
        mode: "insensitive" as const,
      },
    });
  }

  if (resolvedSearchParams?.services) {
    filters.push({
      services: {
        some: {
          name: {
            contains: resolvedSearchParams.services,
            mode: "insensitive" as const,
          },
        },
      },
    });
  }

  const barbershop = await db.barbershop.findMany({
    where: filters.length > 0 ? { OR: filters } : {},
  });

  return (
    <div>
      <Header />
      <div className="mt-4 px-5">
        <SearchItems />
      </div>
      <div className="px-5">
        <h1 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
          Resultados Para &quot;
          {resolvedSearchParams?.title || resolvedSearchParams?.services}&quot;
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
