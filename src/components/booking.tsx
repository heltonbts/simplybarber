import { Avatar, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

import { Prisma } from "../../generated/prisma";
import { format, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import Image from "next/image";
import { BookingSummaryCard } from "./resumer-booking";
import Contact from "./contact";

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
      <Sheet>
        <SheetTrigger className="w-full">
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
        </SheetTrigger>
        <SheetContent className="w-[90%]">
          <SheetHeader>
            <SheetTitle>Informações da Reserva</SheetTitle>
          </SheetHeader>

          <div className="relative h-[180px] w-full flex items-end">
            <Image
              src="/map.png"
              alt="mapa barbearia"
              fill
              className="object-cover"
            />

            <Card className="z-50 w-full mb-3 mx-5 p-0">
              <CardContent className="px-5 py-2 flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={barbershop.imageUrl} />
                </Avatar>
                <div>
                  <h3 className="font-bold">{barbershop.name}</h3>
                  <h3 className="text-xs">{barbershop.address}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="px-2 space-y-3">
            <Badge
              className="w-fit"
              variant={isConfirmed ? "default" : "outline"}
            >
              {isConfirmed ? "Confirmado" : "Finalizado"}
            </Badge>

            <div className="mb-6 mt-3">
              <BookingSummaryCard booking={booking} />
            </div>
            {barbershop.phone.map((phoneNumber, index) => (
              <Contact key={index} phone={phoneNumber} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BookingItem;
