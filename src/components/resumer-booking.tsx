"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Prisma } from "../../generated/prisma";

interface Booking {
  date: string | Date;
  service: {
    name: string;
    price: Prisma.Decimal;
    barbershop: {
      name: string;
    };
  };
}

interface BookingSummaryCardProps {
  booking: Booking;
}

export function BookingSummaryCard({ booking }: BookingSummaryCardProps) {
  const {
    date,
    service: { name, price, barbershop },
  } = booking;

  const dateObj = new Date(date);

  const formattedDate = format(dateObj, "dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(dateObj, "HH:mm");

  const rawPrice =
    typeof price === "object" && "toNumber" in price
      ? price.toNumber()
      : Number(price);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold">{name}</h2>
          <p className="font-bold">
            {Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(rawPrice)}
          </p>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-sm text-gray-400">Data</h2>
          <p className="text-sm">{formattedDate}</p>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-sm text-gray-400">Horário</h2>
          <p className="text-sm">{formattedTime}</p>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-sm text-gray-400">Barbearia</h2>
          <p className="text-sm">{barbershop.name}</p>
        </div>
      </CardContent>
    </Card>
  );
}
