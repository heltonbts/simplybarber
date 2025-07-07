// app/barbershops/[id]/page.tsx

import { db } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, MapPinIcon, StarIcon } from "lucide-react";

import Contact from "@/components/contact";
import ServiceItem from "@/components/service-item";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";

// Tipos para os dados que passaremos como props
type BarberForBookings = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type BarbershopWorkingHourForBookings = {
  weekDay: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  lunchStart: string | null;
  lunchEnd: string | null;
};

// CORREÇÃO 1: Tipagem correta para os parâmetros da página
interface BarbershopPageProps {
  params: {
    id: string;
  };
}

// CORREÇÃO 3: Adicionando fetchCache para garantir que os dados não usem cache
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function BarbershopPage({ params }: BarbershopPageProps) {
  // CORREÇÃO 1: Acessando 'id' diretamente de 'params', sem 'await'
  const { id } = params;

  const barbershop = await db.barbershop.findUnique({
    where: { id },
    include: {
      services: true,
      Barber: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      BarbershopWorkingHour: true,
    },
  });

  if (!barbershop) {
    // Idealmente, usar a função notFound() do Next.js aqui
    return <div>Barbearia não encontrada.</div>;
  }

  // Mapeamento dos dados para o formato esperado pelo componente ServiceItem
  const adaptedBarbers: BarberForBookings[] = barbershop.Barber.map(
    (barber) => ({
      id: barber.id,
      user: barber.user,
    }),
  );

  // CORREÇÃO 2: Removido o 'as any'. Os tipos já são compatíveis.
  const barbershopWorkingHours: BarbershopWorkingHourForBookings[] =
    barbershop.BarbershopWorkingHour;

  return (
    <div>
      <div className="relative h-[250px] w-full">
        <Image
          src={barbershop.imageUrl}
          alt={barbershop.name}
          fill
          className="object-cover"
        />

        <Button
          size="icon"
          className="absolute top-4 left-4 z-10"
          variant="secondary"
          asChild
        >
          <Link href="/">
            <ChevronLeftIcon />
          </Link>
        </Button>

        <div className="absolute top-4 right-4">
          <Sidebar variant="secondary" />
        </div>
      </div>

      <div className="p-5 border-b border-solid">
        <h1 className="font-bold text-xl mb-3">{barbershop.name}</h1>
        <div className="flex items-center gap-1 mb-2">
          <MapPinIcon className="text-primary" size={18} />
          <p className="text-sm">{barbershop.address}</p>
        </div>
        <div className="flex items-center gap-1">
          <StarIcon className="text-primary" size={18} />
          <p className="text-sm">5,0 (522 avaliações)</p>
        </div>
      </div>

      <div className="p-5 border-b border-solid space-y-3">
        <h2 className="font-bold uppercase text-xs text-gray-400">Sobre nós</h2>
        <p className="text-justify">{barbershop.description}</p>
      </div>

      <div className="p-5 border-b border-solid">
        <h2 className="font-bold uppercase text-xs text-gray-400 mb-3">
          Serviços
        </h2>
        <div className="space-y-3">
          {barbershop.services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              barbershop={barbershop}
              availableBarbers={adaptedBarbers}
              barbershopWorkingHours={barbershopWorkingHours}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 p-5">
        {barbershop.phone.map((phone) => (
          <Contact key={phone} phone={phone} />
        ))}
      </div>
    </div>
  );
}
