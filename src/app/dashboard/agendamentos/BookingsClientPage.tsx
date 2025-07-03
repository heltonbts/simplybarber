/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react"; // Adicionado useMemo
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  Users,
  User,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  Bookmark,
  CircleDot,
  Image as FileText, // Renomeado para evitar conflito com Image do next/image
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  format,
  addDays,
  subDays,
  setHours,
  setMinutes,
  isEqual,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";

import {
  createBooking,
  deleteBooking,
  getAvailableTimeSlots,
} from "@/actions/create-booking"; // Caminho da server action de agendamentos

import type {
  BarberForBookings,
  ServiceForBookings,
  BarbershopWorkingHourForBookings,
  BookingForDisplay as BaseBookingForDisplay,
} from "./page";

// Exportando BookingForDisplay para garantir que a tipagem seja globalmente consistente
export type BookingForDisplay = Omit<BaseBookingForDisplay, "user"> & {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

// Constantes para valores de placeholder/erro nos Selects
const UNSELECTED_PLACEHOLDER_VALUE = "UNSELECTED";
const LOADING_SLOTS_VALUE = "LOADING_SLOTS";
const NO_SLOTS_AVAILABLE_VALUE = "NO_SLOTS_AVAILABLE";
const NO_SERVICES_FOUND_VALUE = "NO_SERVICES_FOUND";
const NO_BARBERS_FOUND_VALUE = "NO_BARBERS_FOUND";

// 1. Simplificar Validações (Schema)
const createBookingFormSchema = z
  .object({
    serviceId: z.string().min(1, "Selecione um serviço."), // Simples, mas o refine será necessário se o min(1) for satisfeito pelo placeholder
    barberId: z.string().min(1, "Selecione um barbeiro."),
    date: z
      .date({
        required_error: "Data é obrigatória.",
        invalid_type_error: "Data inválida.",
      })
      .min(
        new Date(new Date().setHours(0, 0, 0, 0)),
        "Não é possível agendar para uma data no passado.",
      ), // Normaliza a data para comparação
    time: z.string().min(1, "Selecione um horário."),

    clientName: z
      .string()
      .max(100, "Nome muito longo.")
      .optional()
      .or(z.literal("")),
    clientPhone: z
      .string()
      .max(50, "Telefone muito longo.")
      .refine((val) => val === "" || /^[0-9,\s\(\)\-+]+$/.test(val), {
        message:
          "Telefones inválidos. Use apenas números, vírgulas, espaços, '(', ')', '-' ou '+'.",
      })
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .max(500, "Observações muito longas.")
      .optional()
      .or(z.literal("")),
  })
  // 1.1 Refine final para garantir que placeholders não passem a validação
  .refine((data) => data.serviceId !== UNSELECTED_PLACEHOLDER_VALUE, {
    message: "Selecione um serviço válido.",
    path: ["serviceId"],
  })
  .refine((data) => data.barberId !== UNSELECTED_PLACEHOLDER_VALUE, {
    message: "Selecione um barbeiro válido.",
    path: ["barberId"],
  })
  .refine(
    (data) =>
      data.time !== UNSELECTED_PLACEHOLDER_VALUE &&
      data.time !== LOADING_SLOTS_VALUE &&
      data.time !== NO_SLOTS_AVAILABLE_VALUE,
    {
      message: "Selecione um horário válido.",
      path: ["time"],
    },
  );

type CreateBookingFormInput = z.infer<typeof createBookingFormSchema>;

export default function BookingsClientPage({
  barbershopId,
  initialSelectedDate,
  initialBarbers,
  initialServices,
  initialBookings,
}: {
  barbershopId: string;
  barbershopName: string;
  initialSelectedDate: Date;
  initialBarbers: BarberForBookings[];
  initialServices: ServiceForBookings[];
  initialBarbershopWorkingHours: BarbershopWorkingHourForBookings[];
  initialBookings: BookingForDisplay[];
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(initialSelectedDate);
  const [bookings, setBookings] =
    useState<BookingForDisplay[]>(initialBookings);
  const [isCreateBookingDialogOpen, setIsCreateBookingDialogOpen] =
    useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  // 2. Gerenciamento de Estado Conflitante (ConfirmedBooking)
  // O estado confirmedBooking é resetado no useEffect e handleCloseCreateBookingDialog
  const [confirmedBooking, setConfirmedBooking] =
    useState<BookingForDisplay | null>(null);

  const form = useForm<CreateBookingFormInput>({
    resolver: zodResolver(createBookingFormSchema),
    defaultValues: {
      serviceId: UNSELECTED_PLACEHOLDER_VALUE,
      barberId: UNSELECTED_PLACEHOLDER_VALUE,
      date: initialSelectedDate,
      time: UNSELECTED_PLACEHOLDER_VALUE,
      clientName: "",
      clientPhone: "",
      notes: "",
    },
    mode: "onBlur",
  });

  // Sincroniza dados iniciais e reinicia o form para um estado limpo/placeholder
  useEffect(() => {
    setBookings(initialBookings);
    setSelectedDate(initialSelectedDate);
    form.setValue("date", initialSelectedDate);
    form.setValue("serviceId", UNSELECTED_PLACEHOLDER_VALUE);
    form.setValue("barberId", UNSELECTED_PLACEHOLDER_VALUE);
    form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE);
    setAvailableSlots([]);
    setConfirmedBooking(null); // Garante que a mensagem de confirmação seja limpa
  }, [initialBookings, initialSelectedDate, form]);

  // 3. Otimizar useEffect para buscar slots
  const watchedSlotDependencies = useMemo(
    () => ({
      // Agrupa as dependências observadas
      serviceId: form.watch("serviceId"),
      barberId: form.watch("barberId"),
      date: form.watch("date"),
    }),
    [form],
  ); // form é a única dependência para useMemo aqui

  useEffect(() => {
    const fetchSlots = async () => {
      const { serviceId, barberId, date } = watchedSlotDependencies; // Pega valores do useMemo

      // Só busca se todos os campos essenciais estiverem selecionados E não forem valores de placeholder
      if (
        serviceId !== UNSELECTED_PLACEHOLDER_VALUE &&
        barberId !== UNSELECTED_PLACEHOLDER_VALUE &&
        date
      ) {
        setFetchingSlots(true);
        form.setValue("time", LOADING_SLOTS_VALUE); // Feedback visual para carregamento
        try {
          const dateOnly = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          );
          const slots = await getAvailableTimeSlots(
            barbershopId,
            dateOnly,
            serviceId,
            barberId,
          );
          setAvailableSlots(slots);
          form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE); // Reseta a seleção de horário após carregar slots
        } catch (error) {
          console.error("Erro ao buscar horários disponíveis:", error);
          toast.error("Falha ao carregar horários disponíveis.", {
            description: "Tente novamente.",
          });
          setAvailableSlots([]);
          form.setValue("time", NO_SLOTS_AVAILABLE_VALUE); // Mostra que não há slots por erro
        } finally {
          setFetchingSlots(false);
        }
      } else {
        setAvailableSlots([]);
        form.setValue("time", UNSELECTED_PLACEHOLDER_VALUE); // Zera se dependências não forem atendidas
      }
    };
    fetchSlots();
  }, [watchedSlotDependencies, barbershopId, form]); // Usa o objeto memoizado como dependência

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      router.push(`/dashboard/agendamentos?date=${format(date, "yyyy-MM-dd")}`);
    }
  };

  const handleCreateBookingSubmit = async (data: CreateBookingFormInput) => {
    // 2. Verificar Estado dos Campos (Adicionar logs para debug)
    console.log("handleCreateBookingSubmit: Função chamada!");
    console.log("Dados do formulário validados (pelo Zod):", data);
    console.log(
      "Erros do formulário ANTES da Server Action:",
      form.formState.errors,
    );
    console.log(
      "Form is Valid ANTES da Server Action:",
      form.formState.isValid,
    );

    // 5. Testar Isoladamente (Log adicional)
    if (!form.formState.isValid) {
      console.error("Formulário inválido, submissão abortada pelo RHF.");
      toast.error("Preencha todos os campos obrigatórios corretamente.");
      return; // Retorna se o formulário for inválido
    }

    // 5. Possível Fix Rápido (Verificação básica) - Zod já faz isso, mas para debug:
    if (
      !data.serviceId ||
      data.serviceId === UNSELECTED_PLACEHOLDER_VALUE ||
      !data.barberId ||
      data.barberId === UNSELECTED_PLACEHOLDER_VALUE ||
      !data.time ||
      data.time === UNSELECTED_PLACEHOLDER_VALUE
    ) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setIsSavingBooking(true);
    console.log("setIsSavingBooking(true) chamado.");
    try {
      console.log("Dentro do bloco try. Tentando criar agendamento...");
      const [hour, minute] = data.time.split(":").map(Number);
      const finalBookingDate = setMinutes(setHours(data.date, hour), minute);

      const result = await createBooking({
        barbershopId,
        serviceId: data.serviceId,
        barberId: data.barberId,
        date: finalBookingDate,
        clientName: data.clientName || null,
        clientPhone: data.clientPhone || null,
        notes: data.notes || null,
      });

      if (result.success && result.booking) {
        toast.success("Agendamento criado com sucesso!");
        setConfirmedBooking({
          ...result.booking,
          user: result.booking.user
            ? {
                name: result.booking.user.name,
                email: (result.booking.user as any).email ?? "",
                image: (result.booking.user as any).image ?? null,
              }
            : null,
        }); // 5. Renderização condicional do agendamento confirmado
        handleCloseCreateBookingDialog(); // Fecha o modal
      } else {
        toast.error("Falha ao agendar.", { description: result.error });
      }
    } catch (error: unknown) {
      console.error(
        "Erro capturado no bloco catch de handleCreateBookingSubmit:",
        error,
      );
      let errorMessage = "Ocorreu um erro inesperado ao criar o agendamento.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      toast.error("Erro ao criar agendamento", { description: errorMessage });
    } finally {
      console.log("Bloco finally executado.");
      setIsSavingBooking(false);
    }
  };

  const handleCloseCreateBookingDialog = () => {
    setIsCreateBookingDialogOpen(false);
    form.reset({
      serviceId: UNSELECTED_PLACEHOLDER_VALUE,
      barberId: UNSELECTED_PLACEHOLDER_VALUE,
      date: selectedDate,
      time: UNSELECTED_PLACEHOLDER_VALUE,
      clientName: "",
      clientPhone: "",
      notes: "",
    });
    form.clearErrors();
    setAvailableSlots([]);
    setConfirmedBooking(null); // Garante que o feedback de confirmação seja resetado
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setIsSavingBooking(true);
    try {
      const result = await deleteBooking(bookingId);
      if (result.success) {
        toast.success("Agendamento cancelado com sucesso!");
      } else {
        toast.error("Falha ao cancelar agendamento.", {
          description: "Ocorreu um erro ao cancelar o agendamento.",
        });
      }
    } catch (error: unknown) {
      console.error("Erro ao cancelar agendamento:", error);
      let errorMessage =
        "Ocorreu um erro inesperado ao cancelar o agendamento.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error("Erro ao cancelar agendamento", {
        description: errorMessage,
      });
    } finally {
      setIsSavingBooking(false);
    }
  };

  const getDayName = useCallback((date: Date) => {
    const today = new Date();
    const normalizeDate = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const normalizedSelectedDate = normalizeDate(date);
    const normalizedToday = normalizeDate(today);
    const normalizedTomorrow = normalizeDate(addDays(today, 1));
    const normalizedYesterday = normalizeDate(subDays(today, 1));

    if (isEqual(normalizedSelectedDate, normalizedToday)) return "Hoje";
    if (isEqual(normalizedSelectedDate, normalizedTomorrow)) return "Amanhã";
    if (isEqual(normalizedSelectedDate, normalizedYesterday)) return "Ontem";

    return format(date, "EEEE", { locale: ptBR });
  }, []);

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:p-6 lg:p-8">
      <Link href="/dashboard">
        <Button variant="ghost" className="flex items-center gap-2 text-white">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </Link>
      <Separator className="bg-white/10" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6" /> Agenda de Agendamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os agendamentos da sua barbearia para o dia{" "}
            <span className="font-semibold text-white">
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} (
              {getDayName(selectedDate)})
            </span>
            .
          </p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={"w-full md:w-auto justify-start text-left font-normal"}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateChange}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
      <Separator className="bg-white/10" />
      <div className="flex justify-end">
        <Dialog
          open={isCreateBookingDialogOpen}
          onOpenChange={setIsCreateBookingDialogOpen}
        >
          <DialogTrigger asChild>
            <Button
              onClick={handleCloseCreateBookingDialog}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
              <DialogDescription>
                Preencha os detalhes para agendar um serviço.
              </DialogDescription>
            </DialogHeader>
            {/* Renderização Condicional do Agendamento Confirmado */}
            {confirmedBooking ? (
              <div className="p-4 border border-green-500 rounded-lg bg-green-900/50 text-white space-y-3">
                <p className="text-lg font-semibold flex items-center gap-2">
                  <CircleDot className="w-5 h-5 text-green-400" /> Agendamento
                  Confirmado!
                </p>
                <p className="text-sm">
                  Serviço:{" "}
                  <span className="font-medium text-primary">
                    {confirmedBooking.service.name}
                  </span>
                </p>
                <p className="text-sm">
                  Barbeiro:{" "}
                  <span className="font-medium text-primary">
                    {confirmedBooking.barber.user.name || "Não definido"}
                  </span>
                </p>
                <p className="text-sm">
                  Data:{" "}
                  <span className="font-medium text-primary">
                    {format(confirmedBooking.date, "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </p>
                {confirmedBooking.clientName && (
                  <p className="text-sm">
                    Cliente:{" "}
                    <span className="font-medium text-primary">
                      {confirmedBooking.clientName}
                    </span>
                  </p>
                )}
                <Button
                  onClick={() => setConfirmedBooking(null)}
                  className="w-full mt-4"
                >
                  Fechar e Agendar Outro
                </Button>
              </div>
            ) : (
              <form
                onSubmit={form.handleSubmit(handleCreateBookingSubmit)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="bookingDate">Data</Label>
                  <Input
                    id="bookingDate"
                    value={format(form.watch("date"), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                    readOnly
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="service">Serviço</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("serviceId", value, {
                        shouldValidate: true,
                      })
                    }
                    value={form.watch("serviceId")}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent className="bg-card text-card-foreground">
                      <SelectItem value={UNSELECTED_PLACEHOLDER_VALUE} disabled>
                        Selecione um serviço
                      </SelectItem>
                      {initialServices.length === 0 ? (
                        <SelectItem value={NO_SERVICES_FOUND_VALUE} disabled>
                          Nenhum serviço disponível
                        </SelectItem>
                      ) : (
                        initialServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} (R${" "}
                            {parseFloat(service.price)
                              .toFixed(2)
                              .replace(".", ",")}{" "}
                            - {service.durationInMinutes} min)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.serviceId && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.serviceId.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="barber">Barbeiro</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("barberId", value, { shouldValidate: true })
                    }
                    value={form.watch("barberId")}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Selecione um barbeiro" />
                    </SelectTrigger>
                    <SelectContent className="bg-card text-card-foreground">
                      <SelectItem value={UNSELECTED_PLACEHOLDER_VALUE} disabled>
                        Selecione um barbeiro
                      </SelectItem>
                      {initialBarbers.length === 0 ? (
                        <SelectItem value={NO_BARBERS_FOUND_VALUE} disabled>
                          Nenhum barbeiro disponível
                        </SelectItem>
                      ) : (
                        initialBarbers.map((barber) => (
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

                <div>
                  <Label htmlFor="time">Horário</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("time", value, { shouldValidate: true })
                    }
                    value={form.watch("time")}
                  >
                    <SelectTrigger
                      className="w-full mt-1"
                      disabled={fetchingSlots || availableSlots.length === 0}
                    >
                      <SelectValue
                        placeholder={
                          fetchingSlots
                            ? "Buscando horários..."
                            : "Selecione um horário"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-card text-card-foreground">
                      <SelectItem value={UNSELECTED_PLACEHOLDER_VALUE} disabled>
                        Selecione um horário
                      </SelectItem>
                      {fetchingSlots ? (
                        <SelectItem value={LOADING_SLOTS_VALUE} disabled>
                          Carregando...
                        </SelectItem>
                      ) : availableSlots.length === 0 ? (
                        <SelectItem value={NO_SLOTS_AVAILABLE_VALUE} disabled>
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
                  {!fetchingSlots &&
                    availableSlots.length === 0 &&
                    form.watch("serviceId") !== UNSELECTED_PLACEHOLDER_VALUE &&
                    form.watch("barberId") !== UNSELECTED_PLACEHOLDER_VALUE &&
                    form.watch("time") === UNSELECTED_PLACEHOLDER_VALUE && (
                      <p className="text-muted-foreground text-sm mt-1">
                        Nenhum horário disponível para a combinação selecionada.
                      </p>
                    )}
                </div>

                <Separator className="bg-muted-foreground/30" />

                <p className="text-sm text-muted-foreground">
                  Informações do Cliente (opcional se agendado por usuário do
                  app)
                </p>
                <div>
                  <Label htmlFor="clientName">Nome do Cliente</Label>
                  <Input
                    id="clientName"
                    {...form.register("clientName")}
                    className="mt-1"
                    placeholder="Nome para agendamentos manuais"
                  />
                  {form.formState.errors.clientName && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.clientName.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="clientPhone">Telefone do Cliente</Label>
                  <Input
                    id="clientPhone"
                    {...form.register("clientPhone")}
                    className="mt-1"
                    placeholder="Telefone para agendamentos manuais"
                  />
                  {form.formState.errors.clientPhone && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.clientPhone.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    {...form.register("notes")}
                    className="mt-1"
                    placeholder="Ex: Preferência por corte específico, etc."
                  />
                  {form.formState.errors.notes && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.notes.message}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseCreateBookingDialog}
                    disabled={isSavingBooking}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSavingBooking}>
                    {isSavingBooking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      "Agendar Horário"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
            <Separator className="bg-white/10" />     {" "}
      <Card className="bg-card text-card-foreground border-border shadow-md">
               {" "}
        <CardHeader>
                   {" "}
          <CardTitle>
                        Agendamentos para            {" "}
            {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}         {" "}
          </CardTitle>
                   {" "}
          <CardDescription>
                        Visualize e gerencie os agendamentos do dia.        
             {" "}
          </CardDescription>
                 {" "}
        </CardHeader>
               {" "}
        <CardContent>
                   {" "}
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                            <XCircle className="w-8 h-8 mx-auto mb-2" />       
                    <p>Nenhum agendamento para este dia.</p>             {" "}
              <p>Use o botão Adicionar Novo Agendamento para começar.</p>       
                 {" "}
            </div>
          ) : (
            <div className="space-y-4">
                           {" "}
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md bg-secondary/20"
                >
                                   {" "}
                  <div className="flex items-center gap-3">
                                       {" "}
                    <Avatar>
                                           {" "}
                      <AvatarImage
                        src={
                          booking.user?.image ||
                          ("image" in booking.barber.user
                            ? (booking.barber.user as { image: string | null })
                                .image
                            : undefined) ||
                          undefined
                        }
                        alt={
                          booking.user?.name ||
                          booking.clientName ||
                          booking.barber.user.name ||
                          "Cliente"
                        }
                      />
                                           {" "}
                      <AvatarFallback>
                                               {" "}
                        {booking.user?.name ? (
                          booking.user.name.charAt(0).toUpperCase()
                        ) : booking.clientName ? (
                          booking.clientName.charAt(0).toUpperCase()
                        ) : booking.barber.user.name ? (
                          booking.barber.user.name.charAt(0).toUpperCase()
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                                             {" "}
                      </AvatarFallback>
                                         {" "}
                    </Avatar>
                                       {" "}
                    <div>
                                           {" "}
                      <p className="font-semibold text-white">
                                               {" "}
                        {booking.user?.name ||
                          booking.clientName ||
                          "Cliente (manual)"}
                                             {" "}
                      </p>
                                           {" "}
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />  
                                             {" "}
                        {format(booking.date, "HH:mm", { locale: ptBR })}       
                                        {" - "}                       {" "}
                        <span className="font-medium text-primary">
                                                    {booking.service.name}     
                                           {" "}
                        </span>
                                             {" "}
                      </p>
                                           {" "}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Users className="w-3 h-3" />{" "}
                        Barbeiro:                        {" "}
                        {booking.barber.user.name || "Não definido"}           
                                 {" "}
                      </p>
                                           {" "}
                      {booking.notes && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                   {" "}
                          <FileText className="w-3 h-3" /> Obs: {booking.notes} 
                                               {" "}
                        </p>
                      )}
                                         {" "}
                    </div>
                                     {" "}
                  </div>
                                   {" "}
                  <AlertDialog>
                                       {" "}
                    <AlertDialogTrigger asChild>
                                           {" "}
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={isSavingBooking}
                      >
                                                <Trash2 className="h-4 w-4" /> 
                                           {" "}
                      </Button>
                                         {" "}
                    </AlertDialogTrigger>
                                       {" "}
                    <AlertDialogContent className="bg-card text-card-foreground border-border">
                                           {" "}
                      <AlertDialogHeader>
                                               {" "}
                        <AlertDialogTitle>
                                                    Cancelar Agendamento?      
                                           {" "}
                        </AlertDialogTitle>
                                               {" "}
                        <AlertDialogDescription>
                                                    Você está prestes a cancelar
                          o agendamento de                          {" "}
                          <span className="font-bold text-white">
                                                       {" "}
                            {booking.user?.name ||
                              booking.clientName ||
                              "Cliente (manual)"}
                                                     {" "}
                          </span>{" "}
                                                    para o serviço de          
                                         {" "}
                          <span className="font-bold text-white">
                                                        {booking.service.name} 
                                                   {" "}
                          </span>{" "}
                                                    com                        
                           {" "}
                          <span className="font-bold text-white">
                                                       {" "}
                            {booking.barber.user.name || "o barbeiro"}         
                                           {" "}
                          </span>{" "}
                                                    às                          {" "}
                          <span className="font-bold text-white">
                                                       {" "}
                            {format(booking.date, "HH:mm", { locale: ptBR })}   
                                                 {" "}
                          </span>{" "}
                                                    em                          {" "}
                          <span className="font-bold text-white">
                                                       {" "}
                            {format(booking.date, "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                                                     {" "}
                          </span>
                                                    . Esta ação não pode ser
                          desfeita.                        {" "}
                        </AlertDialogDescription>
                                             {" "}
                      </AlertDialogHeader>
                                           {" "}
                      <AlertDialogFooter>
                                               {" "}
                        <AlertDialogCancel className="text-white border-border">
                                                    Não, Manter                
                                 {" "}
                        </AlertDialogCancel>
                                               {" "}
                        <AlertDialogAction
                          onClick={() => handleDeleteBooking(booking.id)}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                                                    Sim, Cancelar              
                                   {" "}
                        </AlertDialogAction>
                                             {" "}
                      </AlertDialogFooter>
                                         {" "}
                    </AlertDialogContent>
                                     {" "}
                  </AlertDialog>
                                 {" "}
                </div>
              ))}
                         {" "}
            </div>
          )}
                 {" "}
        </CardContent>
             {" "}
      </Card>
         {" "}
    </div>
  );
}
