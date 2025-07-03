import Contact from "@/components/contact";
import ServiceItem from "@/components/service-item";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/prisma";
import { ChevronLeftIcon, MapPinIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Importar os tipos necessários do arquivo de agendamentos/page.tsx
// Ajuste o caminho conforme a sua estrutura de pastas
import type {
  BarberForBookings,
  BarbershopWorkingHourForBookings,
} from "@/app/dashboard/agendamentos/page";

interface PageProps {
  params: { id: string }; // Use 'params: { id: string }' diretamente, sem Promise
}

export default async function BarbershopPage({ params }: PageProps) {
  const { id } = params; // Acesse 'id' diretamente de params

  const barbershop = await db.barbershop.findUnique({
    where: {
      id: id,
    },
    include: {
      services: true,
      Barber: {
        // Incluir os barbeiros
        include: {
          user: {
            // Incluir os dados do usuário associado ao barbeiro
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      BarbershopWorkingHour: true, // Incluir os horários de funcionamento da barbearia
    },
  });

  if (!barbershop) {
    return <div>Barbershop not found</div>;
  }

  // Adaptar os dados dos barbeiros para o tipo esperado pelo ServiceItem
  const adaptedBarbers: BarberForBookings[] = barbershop.Barber.map(
    (barber) => ({
      id: barber.id,
      user: {
        id: barber.user.id,
        name: barber.user.name,
        email: barber.user.email,
        image: barber.user.image,
      },
    }),
  );

  // O BarbershopWorkingHour já vem no formato correto, mas garantimos o tipo
  const barbershopWorkingHours: BarbershopWorkingHourForBookings[] =
    barbershop.BarbershopWorkingHour;

  return (
    <div>
      <div className="relative h-[250px] w-full">
        <Image
          src={barbershop?.imageUrl}
          alt={barbershop?.name}
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
        <h1 className="font-bold text-xl mb-3">{barbershop?.name}</h1>
        <div className="flex items-center gap-1 mb-2">
          <MapPinIcon className="text-primary" size={18} />
          <p className="text-sm">{barbershop?.address}</p>
        </div>
        <div className="flex items-center gap-1">
          <StarIcon className="text-primary" size={18} />
          <p className="text-sm">5,0 (522 avaliações)</p>
        </div>
      </div>

      <div className="p-5 border-b border-solid space-y-3">
        <h2 className="font-bold uppercase text-xs text-gray-400">Sobre nós</h2>
        <p className="text-justify">{barbershop?.description}</p>
      </div>

      <div className="p-5 border-b border-solid">
        <h2 className="font-bold uppercase text-xs text-gray-400 mb-3">
          Serviços
        </h2>
        <div className="space-y-3 ">
          {barbershop?.services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              barbershop={barbershop}
              availableBarbers={adaptedBarbers} // <-- Agora passando os barbeiros
              barbershopWorkingHours={barbershopWorkingHours} // <-- Agora passando os horários de funcionamento
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
