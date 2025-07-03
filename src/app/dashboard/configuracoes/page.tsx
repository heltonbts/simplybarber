// app/dashboard/settings/page.tsx
import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import SettingsClientPage from "./SettingsClientPage";

// Tipo para os dados da Barbearia vindos do banco de dados (corresponde ao seu Prisma)
export type BarbershopFromDB = {
  id: string;
  name: string;
  address: string;
  phone: string[]; // Certifique-se de que é String[] para o frontend
  description: string;
  imageUrl: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function SettingsPageServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-red-500 text-lg p-4">
        <p>
          Acesso negado. Faça login para gerenciar as configurações da
          barbearia.
        </p>
      </div>
    );
  }

  const barbershop: BarbershopFromDB | null = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!barbershop) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-yellow-500 text-lg p-4 text-center">
        <p>
          Você ainda não tem uma barbearia cadastrada.
          <br />
          Por favor, cadastre-a para gerenciar as configurações.
        </p>
      </div>
    );
  }

  return <SettingsClientPage initialBarbershop={barbershop} />;
}
