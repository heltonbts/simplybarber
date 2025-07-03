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
