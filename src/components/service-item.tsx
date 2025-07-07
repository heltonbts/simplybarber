/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import Image from "next/image";
import { Barbershop, BarbershopService } from "../../generated/prisma";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { useState, useEffect } from "react";
import { format, setHours, setMinutes } from "date-fns";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createBooking } from "@/actions/create-booking";
import type {
  BarberForBookings,
  BarbershopWorkingHourForBookings,
} from "@/app/dashboard/agendamentos/BookingsClientPage";
import { Label } from "@radix-ui/react-label";
import { useLoginAlert } from "./useLoginAlert";

const UNSELECTED_PLACEHOLDER_VALUE = "UNSELECTED";
const LOADING_SLOTS_VALUE = "LOADING_SLOTS";
const NO_SLOTS_AVAILABLE_VALUE = "NO_SLOTS_AVAILABLE";
const NO_BARBERS_FOUND_VALUE = "NO_BARBERS_FOUND";

const createBookingFormSchema = z.object({
  barberId: z
    .string()
    .min(1, "Barbeiro é obrigatório.")
    .refine((val) => val !== UNSELECTED_PLACEHOLDER_VALUE, {
      message: "Selecione um barbeiro válido.",
    }),
  date: z
    .date({
      required_error: "Data é obrigatória.",
      invalid_type_error: "Data inválida.",
    })
    .min(
      new Date(new Date().setHours(0, 0, 0, 0)),
      "Não é possível agendar para uma data no passado.",
    ),
  time: z
    .string()
    .min(1, "Horário é obrigatório.")
    .refine(
      (val) =>
        val !== UNSELECTED_PLACEHOLDER_VALUE &&
        val !== LOADING_SLOTS_VALUE &&
        val !== NO_SLOTS_AVAILABLE_VALUE,
      {
        message: "Selecione um horário válido.",
      },
    ),
});

type CreateBookingFormInput = z.infer<typeof createBookingFormSchema>;

interface ServiceItemProps {
  service: BarbershopService;
  barbershop: Barbershop;
  availableBarbers: BarberForBookings[];
  barbershopWorkingHours: BarbershopWorkingHourForBookings[];
}

const ServiceItem = ({
  service,
  barbershop,
  availableBarbers = [],
}: ServiceItemProps) => {
  const { showLoginAlert, LoginAlertDialog } = useLoginAlert();
  const { data: sessionData, status } = useSession();
  const [bookingSheetIsOpen, setBookingSheetIsOpen] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);

  const form = useForm<CreateBookingFormInput>({
    resolver: zodResolver(createBookingFormSchema),
    defaultValues: {
      barberId: UNSELECTED_PLACEHOLDER_VALUE,
      date: undefined,
      time: UNSELECTED_PLACEHOLDER_VALUE,
    },
    mode: "onBlur",
  });

  const selectedBarberId = form.watch("barberId");
  const selectedDate = form.watch("date");

  useEffect(() => {
    const fetchSlots = async () => {
      if (
        !selectedBarberId ||
        !selectedDate ||
        selectedBarberId === UNSELECTED_PLACEHOLDER_VALUE
      ) {
        setAvailableSlots([]);
        return;
      }

      setFetchingSlots(true);
      try {
        const queryParams = new URLSearchParams({
          barbershopId: barbershop.id,
          serviceId: service.id,
          barberId: selectedBarberId,
          date: selectedDate.toISOString(),
        });

        const response = await fetch(`/api/slots?${queryParams.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Falha ao buscar horários: ${response.statusText}`);
        }

        const slots: string[] = await response.json();

        setAvailableSlots(slots);
      } catch (error) {
        console.error("Erro ao buscar horários via API:", error);
        toast.error("Falha ao carregar horários disponíveis.");
        setAvailableSlots([]);
      } finally {
        form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
        setFetchingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedBarberId, selectedDate, barbershop.id, service.id, form]);

  const handleDaySelected = (date: Date | undefined) => {
    if (date) {
      form.setValue("date", date, { shouldValidate: true });
    }
  };

  const handleCreateBooking = async (data: CreateBookingFormInput) => {
    if (status !== "authenticated" || !sessionData?.user?.id) {
      showLoginAlert();
      return;
    }

    setIsConfirmingBooking(true);
    try {
      const hours = Number(data.time.split(":")[0]);
      const minutes = Number(data.time.split(":")[1]);
      const finalBookingDate = setMinutes(setHours(data.date, hours), minutes);

      const result = await createBooking({
        serviceId: service.id,
        barbershopId: barbershop.id,
        barberId: data.barberId,
        date: finalBookingDate,
      });

      // --- LÓGICA DE SUCESSO COM AUTO-CLOSE ---
      if (result && result.success) {
        toast.success("Reservado com Sucesso!", {
          description: format(
            finalBookingDate,
            "'Para' dd 'de' MMMM 'às' HH:mm'.'",
            { locale: ptBR },
          ),
          duration: 4000,
        });

        // Aguarda 1.5 segundos e então fecha o painel.
        // A limpeza completa do formulário será acionada pelo 'handleOpenSheetOpenChange'.
        setTimeout(() => {
          setBookingSheetIsOpen(false);
        }, 1500);
      } else {
        // Se a reserva falhar, atualiza a lista de horários para o caso de o slot ter sido pego por outra pessoa
        if (result.newAvailableSlots) {
          setAvailableSlots(result.newAvailableSlots);
          form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
        }
        toast.error(result?.error || "Erro ao criar reserva");
      }
    } catch (error) {
      console.error("Erro ao criar reserva:", error);
      toast.error("Erro ao criar reserva");
    } finally {
      setIsConfirmingBooking(false);
    }
  };

  const handleOpenSheetOpenChange = (open: boolean) => {
    setBookingSheetIsOpen(open);
    if (!open) {
      form.reset({
        barberId: UNSELECTED_PLACEHOLDER_VALUE,
        date: undefined,
        time: UNSELECTED_PLACEHOLDER_VALUE,
      });
      form.clearErrors();
      setAvailableSlots([]);
    }
  };

  return (
    <>
      <LoginAlertDialog
        title="Login Necessário"
        description="Você precisa fazer login para agendar um serviço."
        actionText="Fazer Login"
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-2 pt-0 pb-0">
            <div className="relative min-h-[110px] min-w-[110px] max-h-[110px] max-w-[110px]">
              <Image
                src={service.imageUrl}
                alt={service.name}
                fill
                className="rounded-md object-cover"
              />
            </div>
            <div className="space-y-2 flex-1">
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

                  <SheetContent className="overflow-y-auto w-full md:w-[540px] px-0">
                    <SheetHeader className="px-5 text-left">
                      <SheetTitle>Faça sua Reserva</SheetTitle>
                      <SheetDescription>
                        Serviço:{" "}
                        <span className="font-semibold text-primary">
                          {service.name}
                        </span>
                        <br />
                        Barbearia:{" "}
                        <span className="font-semibold">{barbershop.name}</span>
                      </SheetDescription>
                    </SheetHeader>

                    <div className="py-4 flex flex-col items-center border-b border-solid border-border-foreground/20">
                      <Calendar
                        mode="single"
                        selected={form.watch("date")}
                        onSelect={handleDaySelected}
                        disabled={{
                          before: new Date(new Date().setHours(0, 0, 0, 0)),
                        }}
                        locale={ptBR}
                        styles={
                          {
                            /* Seus estilos do calendário */
                          }
                        }
                      />
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {form.watch("date") ? (
                        <>
                          <div>
                            <Label htmlFor="barber">Barbeiro</Label>
                            <Select
                              onValueChange={(value) =>
                                form.setValue("barberId", value, {
                                  shouldValidate: true,
                                })
                              }
                              value={form.watch("barberId")}
                            >
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Selecione um barbeiro" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value={UNSELECTED_PLACEHOLDER_VALUE}
                                  disabled
                                >
                                  Selecione um barbeiro
                                </SelectItem>
                                {availableBarbers.map((barber) => (
                                  <SelectItem key={barber.id} value={barber.id}>
                                    {barber.user.name || barber.user.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {form.watch("barberId") !==
                            UNSELECTED_PLACEHOLDER_VALUE && (
                            <div>
                              <Label htmlFor="time">Horário</Label>
                              <Select
                                onValueChange={(value) =>
                                  form.setValue("time", value, {
                                    shouldValidate: true,
                                  })
                                }
                                value={form.watch("time")}
                                disabled={fetchingSlots}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue
                                    placeholder={
                                      fetchingSlots
                                        ? "Buscando horários..."
                                        : "Selecione um horário"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {fetchingSlots ? (
                                    <SelectItem
                                      value={LOADING_SLOTS_VALUE}
                                      disabled
                                    >
                                      Carregando...
                                    </SelectItem>
                                  ) : availableSlots.length === 0 ? (
                                    <SelectItem
                                      value={NO_SLOTS_AVAILABLE_VALUE}
                                      disabled
                                    >
                                      Nenhum horário disponível
                                    </SelectItem>
                                  ) : (
                                    availableSlots.map((timeSlot) => (
                                      <SelectItem
                                        key={timeSlot}
                                        value={timeSlot}
                                      >
                                        {timeSlot}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-6">
                          <p className="text-sm text-center text-muted-foreground">
                            Por favor, selecione uma data no calendário para ver
                            os barbeiros e horários.
                          </p>
                        </div>
                      )}

                      {form.watch("date") &&
                        form.watch("time") &&
                        form.watch("time") !== UNSELECTED_PLACEHOLDER_VALUE &&
                        form.watch("barberId") !==
                          UNSELECTED_PLACEHOLDER_VALUE && (
                          <Card className="mt-4 bg-secondary/20 border-border">
                            <CardContent className="p-3 space-y-2">
                              {/* Card de Resumo do Agendamento */}
                            </CardContent>
                          </Card>
                        )}
                    </div>

                    <SheetFooter className="px-5">
                      <Button
                        onClick={form.handleSubmit(handleCreateBooking)}
                        disabled={
                          isConfirmingBooking || !form.formState.isValid
                        }
                        className="w-full"
                      >
                        {isConfirmingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirmando...
                          </>
                        ) : (
                          "Confirmar Agendamento"
                        )}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ServiceItem;
