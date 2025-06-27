import { Avatar, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

import { Prisma } from "../../generated/prisma";
import { format, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BookingProps {
  booking: Prisma.BookingGetPayload<{
    include: { service: { include: { barbershop: true } } };
  }>;
}

const BookingItem = ({ booking }: BookingProps) => {
  const {
    service: { barbershop },
  } = booking;

  const isConfirmed = isFuture(booking.date);

  return (
    <>
      <Card className="min-w-[90%]">
        <CardContent className="flex justify-between items-center p-4">
          <div className="flex flex-col gap-2">
            <Badge
              className="w-fit"
              variant={isConfirmed ? "default" : "outline"}
            >
              {isConfirmed ? "Confirmado" : "Finalizado"}
            </Badge>
            <h3 className="font-bold text-lg">{booking.service.name}</h3>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={barbershop.imageUrl} />
              </Avatar>
              <p className="text-sm text-gray-400">{barbershop?.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-white px-4 border-l-2 border-solid ">
            <p className="text-sm font-semibold capitalize">
              {format(booking.date, "MMMM", { locale: ptBR })}
            </p>
            <p className="text-2xl font-bold">
              {format(booking.date, "dd", { locale: ptBR })}
            </p>
            <p className="text-sm font-semibold">
              {format(booking.date, "HH:mm", { locale: ptBR })}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default BookingItem;
