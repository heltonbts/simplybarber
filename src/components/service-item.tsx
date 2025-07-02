"use client";

import Image from "next/image";
import { Barbershop, BarbershopService, Booking } from "../../generated/prisma";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { useEffect, useState } from "react";
import { format, isPast, set } from "date-fns";
import { createBooking } from "@/actions/create-booking";
import { toast } from "sonner";
import { useSession, signIn } from "next-auth/react";
import { getBooking } from "@/actions/get-booking";

interface ServiceItemProps {
  service: BarbershopService;
  barbershop: Barbershop;
  userId: string;
}

const ServiceItem = ({ service, barbershop }: ServiceItemProps) => {
  const { data: sessionData, status } = useSession();
  const [bookingSheetIsOpen, setBookingSheetIsOpen] = useState(false);

  const TIME_LIST = [
    "8:00",
    "8:30",
    "9:00",
    "9:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
  ];

  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);

  const [selectedTime, setSelectedTime] = useState<string | undefined>(
    undefined,
  );

  const loginWithGoogle = async () => {
    await signIn("google");
  };

  const handleDaySelected = (date: Date | undefined) => {
    setSelectedDay(date);
  };

  const handleTimeSelected = (time: string) => {
    setSelectedTime(time);
  };

  const handleCreateBooking = async () => {
    try {
      if (!selectedDay || !selectedTime) return;

      const hours = Number(selectedTime.split(":")[0]);
      const minutes = Number(selectedTime.split(":")[1]);

      const newDate = set(selectedDay, {
        minutes,
        hours,
      });

      if (status !== "authenticated" || !sessionData?.user?.id) {
        toast("Faça login para reservar", {
          action: {
            label: "Login",
            onClick: loginWithGoogle,
          },
        });
        console.error("Tentativa de reserva sem usuário autenticado.");
        return;
      }

      const result = await createBooking({
        serviceId: service.id,
        barbershopId: barbershop.id,
        date: newDate,
      });

      if (result && !result.success) {
        toast.error(result.error || "Erro ao criar reserva");
        return;
      }

      toast.success("Reservado com Sucesso!");

      setBookingSheetIsOpen(false);
      setSelectedDay(undefined);
      setSelectedTime(undefined);
    } catch (error) {
      console.log(error);
      toast.error("Erro ao criar reserva");
    }
  };
  const today = new Date();

  const [dayBooking, setDayBooking] = useState<Booking[]>([]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!selectedDay) {
        setDayBooking([]);
        return;
      }

      try {
        console.log(dayBooking, "Testando");
        console.log(
          `Buscando agendamentos para o dia: ${selectedDay.toISOString()}`,
        );
        const bookings = await getBooking({
          date: selectedDay,
          serviceId: service.id,
        });
        setDayBooking(bookings);
      } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        setDayBooking([]);
      }
    };

    fetchBookings();
  }, [selectedDay, service.id]);

  const handleOpenSheetOpenChange = () => {
    setDayBooking([]);
    setSelectedTime(undefined);
    setSelectedDay(undefined);
    setBookingSheetIsOpen(false);
  };

  const getTimeList = (bookings: Booking[]) => {
    return TIME_LIST.filter((time) => {
      const hour = Number(time.split(":")[0]);
      const minutes = Number(time.split(":")[1]);

      const selectedDate = selectedDay || new Date();

      const timeAsDate = set(selectedDate, {
        hours: hour,
        minutes: minutes,
        seconds: 0,
        milliseconds: 0,
      });

      const isToday =
        format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

      const hasBookingOnCurrentTime = bookings.some(
        (booking) =>
          booking.date.getHours() === hour &&
          booking.date.getMinutes() === minutes,
      );

      if (hasBookingOnCurrentTime) return false;
      if (isToday && isPast(timeAsDate)) return false;

      return true;
    });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-2 pt-0 pb-0">
          <div className="relative min-h-[110px] min-w-[110px] max-h-[110px] max-h-[110px]">
            <Image
              src={service.imageUrl}
              alt={service.name}
              fill
              className="rounded-md"
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{service.name}</h3>
            <p className="text-sm text-gray-400">{service.description}</p>

            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-primary">
                {Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(service.price))}
              </p>

              <Sheet
                open={bookingSheetIsOpen}
                onOpenChange={handleOpenSheetOpenChange}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setBookingSheetIsOpen(true)}
                >
                  Agendar
                </Button>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader className="pb-0 mb-0">
                    <SheetTitle>Faça sua Reserva</SheetTitle>
                  </SheetHeader>
                  <div className="py-1 flex justify-center border-b border-solid">
                    <Calendar
                      disabled={{ before: today }}
                      mode="single"
                      selected={selectedDay}
                      onSelect={handleDaySelected}
                      locale={ptBR}
                      styles={{
                        head_cell: {
                          width: "100%",
                          textTransform: "capitalize",
                        },
                        cell: {
                          width: "100%",
                        },
                        button: {
                          width: "100%",
                        },
                        nav_button_previous: {
                          width: "32px",
                          height: "32px",
                        },
                        nav_button_next: {
                          width: "32px",
                          height: "32px",
                        },
                        caption: {
                          textTransform: "capitalize",
                        },
                      }}
                    />
                  </div>
                  {selectedDay && getTimeList.length > 0 ? (
                    <div className="overflow-x-auto overflow-y-hidden items-center flex gap-3 py-5 [&::-webkit-scrollbar]:hidden border-b border-solid">
                      {getTimeList(dayBooking).map((time) => (
                        <Button
                          variant={
                            selectedTime === time ? "default" : "outline"
                          }
                          key={time}
                          onClick={() => handleTimeSelected(time)}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="p-5 text-sm text-gray-500">
                      Nenhum horário disponível para esse dia.
                    </p>
                  )}
                  {selectedTime && (
                    <div>
                      <Card>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h2 className="font-bold">{service.name}</h2>
                            <p className="font-bold">
                              {Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(service.price))}
                            </p>
                          </div>

                          <div className="flex justify-between items-center">
                            <h2 className="text-sm text-gray-400">Data</h2>
                            <p className="text-sm">
                              {selectedDay
                                ? format(selectedDay, "dd 'de' MMMM", {
                                    locale: ptBR,
                                  })
                                : "Nenhuma"}
                            </p>
                          </div>

                          <div className="flex justify-between items-center">
                            <h2 className="text-sm text-gray-400">Hórario</h2>
                            <p className="text-sm">{selectedTime}</p>
                          </div>

                          <div className="flex justify-between items-center">
                            <h2 className="text-sm text-gray-400">Barbearia</h2>
                            <p className="text-sm">{barbershop?.name}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button
                        onClick={handleCreateBooking}
                        disabled={!selectedDay || !selectedTime}
                      >
                        <p className="text-white font-semibold">Confirmar</p>
                      </Button>
                    </SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceItem;
