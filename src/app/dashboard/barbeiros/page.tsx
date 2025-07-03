// app/dashboard/barbeiros/page.tsx
import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import BarbersClientPage from "./BarbersClientPage";

export type BarberFromDB = {
  id: string;
  userId: string;
  barbershopId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
};

export default async function BarbersPageServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-red-500 text-lg p-4">
        <p>Acesso negado. Faça login para gerenciar os barbeiros.</p>
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
          Por favor, cadastre-a para gerenciar os barbeiros.
        </p>
      </div>
    );
  }

  const barbers: BarberFromDB[] = await db.barber.findMany({
    where: { barbershopId: barbershop.id },
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
    orderBy: { user: { name: "asc" } },
  });

  return <BarbersClientPage initialBarbers={barbers} />;
}
