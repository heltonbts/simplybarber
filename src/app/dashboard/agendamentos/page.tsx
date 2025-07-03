import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/prisma";

import { getBarbersByBarbershop } from "@/actions/barber-actions";
import { getServicesByBarbershop } from "@/actions/ServiceActions";

import { ManualBookingForm } from "@/components/dashboard/manual-booking-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function ManualBookingPage() {
  // 1. Validar a sessão do usuário
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // Se não estiver logado, redireciona para o login
    redirect("/");
  }

  // 2. Encontrar a barbearia pertencente ao usuário logado
  // (Assumindo que um usuário gerencia apenas uma barbearia para simplificar)
  const barbershop = await db.barbershop.findFirst({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ownerId: (session.user as any).id,
    },
  });

  if (!barbershop) {
    // Se o usuário não for dono de nenhuma barbearia, mostra uma mensagem
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Nenhuma Barbearia Encontrada</CardTitle>
            <CardDescription>
              Você precisa ser o proprietário de uma barbearia para acessar esta
              página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Por favor, cadastre sua barbearia ou entre em contato com o
              suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Buscar os dados necessários no servidor
  const [barbers, services] = await Promise.all([
    getBarbersByBarbershop(barbershop.id),
    getServicesByBarbershop(barbershop.id),
  ]);

  // 4. Renderizar o componente de cliente, passando os dados como props
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <ManualBookingForm
        barbershopId={barbershop.id}
        barbers={JSON.parse(JSON.stringify(barbers))}
        services={JSON.parse(JSON.stringify(services))} // Serialização para evitar erros
      />
    </div>
  );
}
