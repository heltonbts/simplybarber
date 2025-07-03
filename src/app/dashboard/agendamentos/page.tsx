// app/dashboard/agendamentos/page.tsx
import { db } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import BookingsClientPage from "./BookingsClientPage";
import { startOfDay, endOfDay } from "date-fns"; // Para filtrar agendamentos do dia

// Tipos para os dados que serão passados para o componente cliente
// (Esses tipos podem ser definidos aqui e exportados, ou em um arquivo de tipos compartilhado)

// Tipo para os dados de Barbeiro (com user incluído)
export type BarberForBookings = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

// Tipo para os dados de Serviço (com detalhes da barbearia incluídos)
export type ServiceForBookings = {
  id: string;
  name: string;
  price: string; // Decimal do Prisma, convertido para string
  durationInMinutes: number;
  barbershopId: string;
};

// Tipo para os dados de Horário de Funcionamento da Barbearia
export type BarbershopWorkingHourForBookings = {
  weekDay: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  lunchStart: string | null;
  lunchEnd: string | null;
};

// Tipo para os dados de Agendamento (com detalhes para exibição)
export type BookingForDisplay = {
  id: string;
  date: Date;
  serviceId: string;
  barberId: string;
  barbershopId: string;
  clientName: string | null;
  clientPhone: string | null;
  notes: string | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  } | null; // Pode ser null para agendamentos manuais
  service: {
    name: string;
    durationInMinutes: number;
  };
  barber: {
    user: {
      name: string | null;
    };
  };
};

export default async function AgendamentosPageServer({
  searchParams, // Parâmetros de busca da URL (ex: ?date=YYYY-MM-DD)
}: {
  searchParams?: { date?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-red-500 text-lg p-4">
        <p>Acesso negado. Faça login para gerenciar os agendamentos.</p>
      </div>
    );
  }

  const barbershop = await db.barbershop.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, address: true }, // Seleciona apenas o necessário
  });

  if (!barbershop) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] text-yellow-500 text-lg p-4 text-center">
        <p>
          Você ainda não tem uma barbearia cadastrada.
          <br />
          Por favor, cadastre-a para gerenciar os agendamentos.
        </p>
      </div>
    );
  }

  // Define a data atual como padrão se nenhuma data for fornecida nos searchParams
  const selectedDateParam = searchParams?.date
    ? new Date(searchParams.date)
    : new Date();

  // Garante que selectedDateParam seja uma data válida, caso contrário, usa a data atual
  const today = new Date();
  const selectedDate = isNaN(selectedDateParam.getTime())
    ? today
    : selectedDateParam;

  // Ajusta a data para o início e fim do dia para a consulta do banco
  const startOfSelectedDay = startOfDay(selectedDate);
  const endOfSelectedDay = endOfDay(selectedDate);

  // Busca todos os dados necessários em paralelo para otimizar a performance
  const [barbers, services, barbershopWorkingHours, bookingsForSelectedDay] =
    await Promise.all([
      // Barbeiros da barbearia
      db.barber.findMany({
        where: { barbershopId: barbershop.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { user: { name: "asc" } },
      }),
      // Serviços da barbearia
      db.barbershopService.findMany({
        where: { barbershopId: barbershop.id },
        orderBy: { name: "asc" },
      }),
      // Horário de funcionamento da barbearia
      db.barbershopWorkingHour.findMany({
        where: { barbershopId: barbershop.id },
        orderBy: { weekDay: "asc" },
      }),
      // Agendamentos para o dia selecionado
      db.booking.findMany({
        where: {
          barbershopId: barbershop.id,
          date: {
            gte: startOfSelectedDay,
            lte: endOfSelectedDay,
          },
        },
        include: {
          user: { select: { name: true, email: true, image: true } }, // Para agendamentos de usuários registrados
          service: { select: { name: true, durationInMinutes: true } }, // Nome e duração do serviço
          barber: { select: { user: { select: { name: true } } } }, // Nome do barbeiro associado
        },
        orderBy: { date: "asc" }, // Ordena os agendamentos por horário
      }),
    ]);

  // Adapta os dados para os tipos esperados pelo cliente
  const adaptedServices: ServiceForBookings[] = services.map((s) => ({
    ...s,
    price: s.price.toString(), // Converte Decimal para string
  }));

  const adaptedBarbers: BarberForBookings[] = barbers.map((b) => ({
    id: b.id,
    user: {
      id: b.user.id,
      name: b.user.name,
      email: b.user.email,
      image: b.user.image,
    },
  }));
  const adaptedBookings: BookingForDisplay[] = bookingsForSelectedDay.map(
    (b) => ({
      id: b.id,
      date: b.date,
      serviceId: b.serviceId,
      barberId: b.barberId,
      barbershopId: b.barbershopId,
      clientName: b.clientName,
      clientPhone: b.clientPhone,
      notes: b.notes,
      user: b.user
        ? {
            name: b.user.name,
            email: b.user.email,
            image: b.user.image ?? null,
          }
        : null,
      service: {
        name: b.service.name,
        durationInMinutes: b.service.durationInMinutes,
      },
      barber: { user: { name: b.barber.user.name } },
    }),
  );

  // Passa todos os dados para o componente cliente
  return (
    <BookingsClientPage
      barbershopId={barbershop.id}
      barbershopName={barbershop.name}
      initialSelectedDate={selectedDate}
      initialBarbers={adaptedBarbers}
      initialServices={adaptedServices}
      initialBarbershopWorkingHours={barbershopWorkingHours}
      initialBookings={adaptedBookings}
    />
  );
}
