// app/dashboard/horarios/page.tsx
import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import HorariosClientPage from "./HorariosClientPage";

// Definindo o tipo base para WorkingHour, correspondendo ao seu Prisma e ao cliente
export type WorkingHour = {
  weekDay: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  isOpen: boolean;
  openTime: string; // Ex: "09:00"
  closeTime: string; // Ex: "18:00"
  lunchStart: string | null; // Pode ser null
  lunchEnd: string | null; // Pode ser null
};

// Mapeamento dos dias da semana (usado para garantir todos os 7 dias)
const diasDaSemanaStandard = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default async function HorariosPageServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // É uma boa prática redirecionar ou renderizar um componente de erro aqui
    // em vez de passar um estado inválido para o cliente.
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-red-500 text-lg p-4">
        <p>Acesso negado. Faça login para gerenciar os horários.</p>
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
          Por favor, cadastre-a para gerenciar os horários.
        </p>
      </div>
    );
  }

  const horariosDoBanco = await db.barbershopWorkingHour.findMany({
    where: { barbershopId: barbershop.id },
    orderBy: { weekDay: "asc" },
  });

  // Garante que haja um objeto de horário para cada um dos 7 dias da semana
  // Isso é crucial para o componente cliente não falhar ao iterar
  const initialHours: WorkingHour[] = diasDaSemanaStandard.map((_, index) => {
    const existingHour = horariosDoBanco.find((h) => h.weekDay === index);

    if (existingHour) {
      return {
        weekDay: existingHour.weekDay,
        isOpen: existingHour.isOpen,
        openTime: existingHour.openTime,
        closeTime: existingHour.closeTime,
        lunchStart: existingHour.lunchStart || null, // Garante que seja null se for string vazia ou undefined
        lunchEnd: existingHour.lunchEnd || null, // Garante que seja null
      };
    } else {
      // Valor padrão para dias não configurados no banco de dados
      return {
        weekDay: index,
        isOpen: false, // Por padrão, um dia não configurado é considerado fechado
        openTime: "09:00", // Valores padrão razoáveis para facilitar a edição
        closeTime: "18:00",
        lunchStart: null,
        lunchEnd: null,
      };
    }
  });

  // Passa o array completo e normalizado para o componente cliente
  return <HorariosClientPage initialData={initialHours} />;
}
