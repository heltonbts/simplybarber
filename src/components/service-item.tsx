"use client";

import Image from "next/image";
import { Barbershop, BarbershopService } from "../../generated/prisma";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { format, set } from "date-fns";
import { createBooking } from "@/actions/create-booking";
import { toast } from "sonner";

interface ServiceItemProps {
  service: BarbershopService;
  barbershop: Pick<Barbershop, "name">;
}
const ServiceItem = ({ service, barbershop }: ServiceItemProps) => {
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

      await createBooking({
        serviceId: service.id,
        userId: "cmcc147240000icgv6njlrkvh",
        date: newDate,
      });
      toast.success("Reservado com Sucesso!");
    } catch (error) {
      console.log(error);
      toast("Error ao criar reserva");
    }
  };

  const today = new Date();

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

              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="secondary">
                    Agendar
                  </Button>
                </SheetTrigger>
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
                  {selectedDay && (
                    <div className="overflow-x-auto overflow-y-hidden items-center flex gap-3 py-5 [&::-webkit-scrollbar]:hidden border-b border-solid">
                      {TIME_LIST.map((time) => (
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
                      <Button asChild onClick={handleCreateBooking}>
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
