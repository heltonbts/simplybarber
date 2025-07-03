// app/dashboard/servicos/page.tsx
import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import ServicosClientPage from "./ServicosClientPage";

export type BarbershopServiceFromDB = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  durationInMinutes: number;
  barbershopId: string;
};

export default async function ServicosPageServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-red-500 text-lg p-4">
        <p>Acesso negado. Faça login para gerenciar os serviços.</p>
      </div>
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-yellow-500 text-lg p-4 text-center">
        <p>
          Você ainda não tem uma barbearia cadastrada.
          <br />
          Por favor, cadastre-a para gerenciar os serviços.
        </p>
      </div>
    );
  }

  const rawServices = await db.barbershopService.findMany({
    where: { barbershopId: barbershop.id },
    orderBy: { name: "asc" },
  });

  const services: BarbershopServiceFromDB[] = rawServices.map((service) => ({
    ...service,
    price: service.price.toString(),
  }));

  return <ServicosClientPage initialServices={services} />;
}
