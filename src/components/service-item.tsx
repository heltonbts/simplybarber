"use client";

import Image from "next/image";
import { Barbershop, BarbershopService } from "../../generated/prisma"; // Ajustar caminho para os types do Prisma se necessário
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

import { createBooking, getAvailableTimeSlots } from "@/actions/create-booking"; // createBooking, getAvailableTimeSlots
import type {
  BarberForBookings,
  BarbershopWorkingHourForBookings,
} from "@/app/dashboard/agendamentos/BookingsClientPage"; // Tipos de barbeiro/horários
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

  useEffect(() => {
    const fetchSlots = async () => {
      const barberId = form.watch("barberId");
      const date = form.watch("date");

      if (barberId && date && barberId !== UNSELECTED_PLACEHOLDER_VALUE) {
        setFetchingSlots(true);
        try {
          const dateOnly = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          );
          const slots = await getAvailableTimeSlots(
            barbershop.id,
            dateOnly,
            service.id,
            barberId,
          );
          setAvailableSlots(slots);
          form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE); // Reseta o horário após buscar novos slots
        } catch (error) {
          console.error("Erro ao buscar horários disponíveis:", error);
          toast.error("Falha ao carregar horários disponíveis.", {
            description: "Tente novamente.",
          });
          setAvailableSlots([]);
          form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
        } finally {
          setFetchingSlots(false);
        }
      } else {
        setAvailableSlots([]);
        form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
      }
    };
    fetchSlots();
  }, [
    form.watch("barberId"),
    form.watch("date"),
    barbershop.id,
    service.id,
    form,
  ]);

  // Função para lidar com a seleção de data no calendário
  const handleDaySelected = (date: Date | undefined) => {
    if (date) {
      form.setValue("date", date); // Atualiza o campo 'date' do formulário
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

      const finalBookingDate = setMinutes(setHours(data.date, hours), minutes); // Combina data e hora

      const result = await createBooking({
        serviceId: service.id,
        barbershopId: barbershop.id,
        barberId: data.barberId, // Passa o barbeiro selecionado
        date: finalBookingDate,
        // clientName e clientPhone não são necessários aqui (para cliente agendando para si)
        // A server action createBooking lidará com o userId da sessão.
      });

      if (result && result.success) {
        toast.success("Reservado com Sucesso!");
        setBookingSheetIsOpen(false);
        // Resetar o formulário para o estado inicial após a reserva bem-sucedida
        form.reset({
          barberId: UNSELECTED_PLACEHOLDER_VALUE,
          date: undefined, // Ou selectedDay se você quiser manter a data no calendário
          time: UNSELECTED_PLACEHOLDER_VALUE,
        });
        setAvailableSlots([]); // Limpar slots
      } else {
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
        description="Você precisa fazer login para agendar um serviço na barbearia."
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
                className="rounded-md object-cover" // Added object-cover for better image fitting
              />
            </div>
            <div className="space-y-2 flex-1">
              {" "}
              {/* flex-1 para ocupar espaço */}
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
                    {" "}
                    {/* Ajuste de largura e padding */}
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
                        <br />
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-4 flex flex-col items-center border-b border-solid border-border-foreground/20">
                      <Calendar
                        mode="single"
                        selected={form.watch("date")} // Sincroniza com o React Hook Form
                        onSelect={handleDaySelected}
                        disabled={{
                          before: new Date(new Date().setHours(0, 0, 0, 0)),
                        }} // Desabilita dias passados
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
                    {/* Formulário de Seleção de Barbeiro e Horário */}
                    <div className="px-5 py-4 space-y-4">
                      {/* Seleção de Barbeiro */}
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
                          <SelectContent className="bg-card text-card-foreground">
                            <SelectItem
                              value={UNSELECTED_PLACEHOLDER_VALUE}
                              disabled
                            >
                              Selecione um barbeiro
                            </SelectItem>
                            {availableBarbers.length === 0 ? (
                              <SelectItem
                                value={NO_BARBERS_FOUND_VALUE}
                                disabled
                              >
                                Nenhum barbeiro disponível
                              </SelectItem>
                            ) : (
                              availableBarbers.map((barber) => (
                                <SelectItem key={barber.id} value={barber.id}>
                                  {barber.user.name || barber.user.email}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.barberId && (
                          <p className="text-red-500 text-sm mt-1">
                            {form.formState.errors.barberId.message}
                          </p>
                        )}
                      </div>

                      {/* Seleção de Horário */}
                      <div>
                        <Label htmlFor="time">Horário</Label>
                        <Select
                          onValueChange={(value) =>
                            form.setValue("time", value, {
                              shouldValidate: true,
                            })
                          }
                          value={form.watch("time")}
                          disabled={
                            fetchingSlots ||
                            !form.watch("barberId") ||
                            !form.watch("date")
                          } // Desabilita se barbeiro ou data não selecionados
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue
                              placeholder={
                                fetchingSlots
                                  ? "Buscando horários..."
                                  : !form.watch("barberId") ||
                                      !form.watch("date")
                                    ? "Selecione a data e o barbeiro"
                                    : "Selecione um horário"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-card text-card-foreground">
                            <SelectItem
                              value={UNSELECTED_PLACEHOLDER_VALUE}
                              disabled
                            >
                              Selecione um horário
                            </SelectItem>
                            {fetchingSlots ? (
                              <SelectItem value={LOADING_SLOTS_VALUE} disabled>
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
                                <SelectItem key={timeSlot} value={timeSlot}>
                                  {timeSlot}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.time && (
                          <p className="text-red-500 text-sm mt-1">
                            {form.formState.errors.time.message}
                          </p>
                        )}
                        {/* Mensagem de ajuda para seleção de horário */}
                        {!fetchingSlots &&
                          availableSlots.length === 0 &&
                          form.watch("barberId") !==
                            UNSELECTED_PLACEHOLDER_VALUE &&
                          form.watch("date") && (
                            <p className="text-muted-foreground text-sm mt-1">
                              Nenhum horário disponível para a combinação
                              selecionada.
                            </p>
                          )}
                      </div>

                      {/* Exibição resumida do agendamento */}
                      {form.watch("date") &&
                        form.watch("time") &&
                        form.watch("barberId") !==
                          UNSELECTED_PLACEHOLDER_VALUE && (
                          <Card className="mt-4 bg-secondary/20 border-border">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <h2 className="font-bold text-sm">
                                  {service.name}
                                </h2>
                                <p className="font-bold text-sm text-primary">
                                  {Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(Number(service.price))}
                                </p>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <h2 className="text-gray-400">Barbeiro</h2>
                                <p className="text-sm">
                                  {availableBarbers.find(
                                    (b) => b.id === form.watch("barberId"),
                                  )?.user.name || "N/A"}
                                </p>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <h2 className="text-gray-400">Data</h2>
                                <p className="text-sm">
                                  {format(form.watch("date"), "dd 'de' MMMM", {
                                    locale: ptBR,
                                  })}
                                </p>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <h2 className="text-gray-400">Horário</h2>
                                <p className="text-sm">{form.watch("time")}</p>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <h2 className="text-gray-400">Barbearia</h2>
                                <p className="text-sm">{barbershop?.name}</p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                    </div>{" "}
                    {/* Fim px-5 py-4 */}
                    <SheetFooter className="px-5">
                      <Button
                        onClick={form.handleSubmit(handleCreateBooking)} // Usa handleSubmit do RHF
                        disabled={
                          isConfirmingBooking || !form.formState.isValid
                        } // Desabilita se estiver confirmando ou se o form for inválido
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
