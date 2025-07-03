// components/bookings/DailyScheduleView.tsx
"use client";

import React from "react";
import {
  format,
  setHours,
  setMinutes,
  addMinutes,
  differenceInMinutes,
  isBefore,
  isEqual,
} from "date-fns";
import { Clock, User } from "lucide-react"; // Importa ícones

// Importa os tipos do Server Component da página de agendamentos
import type {
  BarbershopWorkingHourForBookings,
  BookingForDisplay,
} from "@/app/dashboard/agendamentos/page";

interface DailyScheduleViewProps {
  selectedDate: Date; // A data que está sendo exibida (para extrair o dia, mês, ano)
  workingHour: BarbershopWorkingHourForBookings | null; // Horário de funcionamento da barbearia para o dia selecionado
  bookings: BookingForDisplay[]; // Agendamentos para o dia selecionado
}

export default function DailyScheduleView({
  selectedDate,
  workingHour,
  bookings,
}: DailyScheduleViewProps) {
  // Se não houver horário de funcionamento ou a barbearia estiver fechada
  if (!workingHour || !workingHour.isOpen) {
    return (
      <div className="text-center py-8 text-muted-foreground bg-card/50 rounded-lg">
        <Clock className="w-8 h-8 mx-auto mb-2" />
        <p>Barbearia fechada neste dia.</p>
        <p className="text-sm">
          Consulte os horários de funcionamento nas configurações.
        </p>
      </div>
    );
  }

  const generateTimeSlots = () => {
    const slots: { time: string; fullDate: Date }[] = [];
    const [openHour, openMinute] = workingHour.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = workingHour.closeTime
      .split(":")
      .map(Number);

    let currentTime = setMinutes(setHours(selectedDate, openHour), openMinute);
    const endOfWorkDay = setMinutes(
      setHours(selectedDate, closeHour),
      closeMinute,
    );

    while (
      isBefore(currentTime, endOfWorkDay) ||
      isEqual(currentTime, endOfWorkDay)
    ) {
      slots.push({ time: format(currentTime, "HH:mm"), fullDate: currentTime });
      currentTime = addMinutes(currentTime, 30); // Incremento de 30 em 30 minutos na linha do tempo
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Calcular a posição e altura dos agendamentos
  const getBookingStyle = (booking: BookingForDisplay) => {
    const [openHour, openMinute] = workingHour.openTime.split(":").map(Number);
    const startOfWorkDay = setMinutes(
      setHours(selectedDate, openHour),
      openMinute,
    );

    const startMinutes = differenceInMinutes(booking.date, startOfWorkDay);
    const durationMinutes = booking.service.durationInMinutes;

    // Calcula 'top' como porcentagem da altura total do dia
    // Assumindo 30 minutos = 20px de altura por slot (para fins de exemplo)
    const slotHeightPx = 20; // Altura de cada bloco de 30 minutos
    const topPx = (startMinutes / 30) * slotHeightPx; // Posição em pixels do topo
    const heightPx = (durationMinutes / 30) * slotHeightPx; // Altura em pixels do bloco do agendamento

    return {
      top: `${topPx}px`,
      height: `${heightPx}px`,
      // Cores para diferenciar agendamentos
      backgroundColor: `hsl(var(--primary) / 0.7)`,
      borderColor: `hsl(var(--primary))`,
    };
  };

  return (
    <div className="relative border border-border rounded-lg bg-card text-card-foreground p-2">
      {/* Linha do tempo com horários fixos */}
      <div className="flex flex-col">
        {timeSlots.map((slot, index) => (
          <div
            key={slot.time}
            className="flex items-center h-[20px] text-xs text-muted-foreground"
          >
            {" "}
            {/* Altura do slot fixo */}
            {index % 2 === 0 ? ( // Mostra a hora a cada hora ou a cada 2 slots (09:00, 10:00, etc.)
              <span className="w-12 text-right pr-2">
                {format(slot.fullDate, "HH:mm")}
              </span>
            ) : (
              <span className="w-12 text-right pr-2 opacity-50"></span> // Para alinhar, mas sem texto
            )}
            <div className="flex-1 border-b border-dashed border-border/50 h-px"></div>
          </div>
        ))}
      </div>

      {/* Blocos de Agendamentos sobrepostos */}
      <div className="absolute top-0 bottom-0 left-12 right-0">
        {" "}
        {/* Ajusta left para depois da coluna de tempo */}
        {bookings.map((booking) => (
          <div
            key={booking.id}
            style={getBookingStyle(booking)}
            className="absolute rounded-md border text-white p-1 text-xs overflow-hidden flex flex-col justify-center transition-all duration-200 ease-in-out"
          >
            <p className="font-semibold truncate">{booking.service.name}</p>
            <p className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate">
                {booking.user?.name || booking.clientName || "Cliente Manual"}
              </span>
            </p>
            <p className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(booking.date, "HH:mm")} (
              {booking.service.durationInMinutes} min)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
