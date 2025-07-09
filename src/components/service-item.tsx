"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Label } from "@radix-ui/react-label";
import { useLoginAlert } from "./useLoginAlert";

const UNSELECTED_PLACEHOLDER_VALUE = "UNSELECTED";
const NO_SLOTS_AVAILABLE_VALUE = "NO_SLOTS_AVAILABLE";

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
      "Data no passado inválida.",
    ),
  time: z
    .string()
    .min(1, "Horário é obrigatório.")
    .refine(
      (val) =>
        val !== UNSELECTED_PLACEHOLDER_VALUE &&
        val !== NO_SLOTS_AVAILABLE_VALUE,
      {
        message: "Selecione um horário válido.",
      },
    ),
});

type CreateBookingFormInput = z.infer<typeof createBookingFormSchema>;

interface Barber {
  id: string;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface ServiceItemProps {
  service: BarbershopService;
  barbershop: Barbershop;
  availableBarbers: Barber[];
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

  const fetchAvailableSlots = async (showLoading = true) => {
    const barberId = form.watch("barberId");
    const date = form.watch("date");

    if (!barberId || barberId === UNSELECTED_PLACEHOLDER_VALUE || !date) {
      setAvailableSlots([]);
      form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
      return;
    }

    if (showLoading) {
      setFetchingSlots(true);
    }

    try {
      const dateString = format(date, "yyyy-MM-dd");

      console.log("🔍 Buscando slots para:", {
        barbershopId: barbershop.id,
        serviceId: service.id,
        barberId,
        date: dateString,
        serviceName: service.name,
        serviceDuration: service.durationInMinutes + " minutos",
      });

      const res = await fetch(
        `/api/slots?barbershopId=${barbershop.id}&serviceId=${service.id}&barberId=${barberId}&date=${encodeURIComponent(dateString)}&_t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log("✅ Resposta da API recebida:", data);

      console.log("✅ Slots recebidos:", data.slots);
      console.log("📊 Total de slots disponíveis:", data.slots.length);

      setAvailableSlots(data.slots || []);

      // Reset time selection if current time is no longer available
      const currentTime = form.watch("time");
      if (currentTime && currentTime !== UNSELECTED_PLACEHOLDER_VALUE) {
        if (!data.slots.includes(currentTime)) {
          console.log(
            "⚠️ Horário selecionado não está mais disponível, resetando...",
          );
          form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
        }
      }
    } catch (err) {
      console.error("❌ Erro ao buscar horários:", err);
      toast.error("Erro ao buscar horários disponíveis");
      setAvailableSlots([]);
      form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
    } finally {
      if (showLoading) {
        setFetchingSlots(false);
      }
    }
  };

  // Fetch slots when barber or date changes
  useEffect(() => {
    fetchAvailableSlots();
  }, [form.watch("barberId"), form.watch("date")]);

  const handleDaySelected = (date: Date | undefined) => {
    if (date) {
      form.setValue("date", date);
      form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
    }
  };

  const handleSubmit = async (data: CreateBookingFormInput) => {
    if (status !== "authenticated" || !sessionData?.user?.id) {
      showLoginAlert();
      return;
    }

    setIsConfirmingBooking(true);

    try {
      // FIXED: Pass the date as a string to avoid timezone conversion issues
      const dateString = format(data.date, "yyyy-MM-dd");

      const bookingData = {
        barbershopId: barbershop.id,
        barberId: data.barberId,
        serviceId: service.id,
        userId: sessionData.user.id,
        selectedDate: dateString,
        selectedTime: data.time,
      };

      console.log("📤 Sending booking data:", bookingData);

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData?.error || `Erro ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("✅ Booking created successfully:", result);

      // Refresh available slots
      await fetchAvailableSlots(false);

      toast.success("Agendamento confirmado com sucesso!");

      // Reset form
      form.reset({
        barberId: UNSELECTED_PLACEHOLDER_VALUE,
        date: undefined,
        time: UNSELECTED_PLACEHOLDER_VALUE,
      });

      setBookingSheetIsOpen(false);
    } catch (error) {
      console.error("❌ Error creating booking:", error);
      await fetchAvailableSlots(false);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao criar agendamento";
      toast.error(errorMessage);
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
    }
  };

  // Função para refrescar manualmente os slots (útil para debugging)
  const handleRefreshSlots = async () => {
    console.log("🔄 Atualizando horários manualmente...");
    await fetchAvailableSlots();
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
                <div className="flex flex-col">
                  <p className="font-bold text-sm text-primary">
                    {Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(service.price))}
                  </p>
                  <p className="text-xs text-gray-500">
                    Duração: {service.durationInMinutes} min
                  </p>
                </div>
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
                        <br /> Barbearia:{" "}
                        <span className="font-semibold">{barbershop.name}</span>
                        <br /> Duração:{" "}
                        <span className="font-semibold">
                          {service.durationInMinutes} minutos
                        </span>
                      </SheetDescription>
                    </SheetHeader>

                    <div className="py-4 flex flex-col items-center border-b border-border-foreground/20">
                      <Calendar
                        mode="single"
                        selected={form.watch("date")}
                        onSelect={handleDaySelected}
                        disabled={{
                          before: new Date(new Date().setHours(0, 0, 0, 0)),
                        }}
                        locale={ptBR}
                      />
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {form.watch("date") ? (
                        <>
                          <div>
                            <Label>Barbeiro</Label>
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
                              <div className="flex items-center justify-between">
                                <Label>Horário</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleRefreshSlots}
                                  disabled={fetchingSlots}
                                  className="text-xs"
                                >
                                  {fetchingSlots
                                    ? "Atualizando..."
                                    : "Atualizar"}
                                </Button>
                              </div>
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
                                    <SelectItem value="loading" disabled>
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
                              {availableSlots.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {availableSlots.length} horário(s)
                                  disponível(is)
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground">
                          Por favor, selecione uma data no calendário.
                        </p>
                      )}
                    </div>

                    <SheetFooter className="px-5">
                      <Button
                        onClick={form.handleSubmit(handleSubmit)}
                        disabled={
                          isConfirmingBooking ||
                          !form.formState.isValid ||
                          availableSlots.length === 0 ||
                          fetchingSlots
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
