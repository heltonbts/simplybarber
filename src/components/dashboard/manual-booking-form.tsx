"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Loader2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Prisma } from "../../../generated/prisma";

// Componentes Shadcn/UI
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// Actions de Agendamento
import { getAvailableTimeSlots, createBooking } from "@/actions/create-booking";

// Tipos para as props recebidas do Server Component
type BarberPayload = Prisma.BarberGetPayload<{
  include: { user: { select: { name: true } } };
}>;
type ServicePayload = Prisma.BarbershopServiceGetPayload<object>;

interface ManualBookingFormProps {
  barbershopId: string;
  barbers: BarberPayload[];
  services: ServicePayload[];
}

// Schema de validação com Zod
const formSchema = z.object({
  serviceId: z.string({ required_error: "Selecione um serviço." }),
  barberId: z.string({ required_error: "Selecione um barbeiro." }),
  date: z.date({ required_error: "Selecione uma data." }),
  time: z.string({ required_error: "Selecione um horário." }),
  clientName: z
    .string()
    .min(3, { message: "O nome precisa ter pelo menos 3 caracteres." }),
  clientPhone: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function ManualBookingForm({
  barbershopId,
  barbers,
  services,
}: ManualBookingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      clientPhone: "",
      notes: "",
    },
  });

  const selectedDate = watch("date");
  const selectedServiceId = watch("serviceId");
  const selectedBarberId = watch("barberId");

  useEffect(() => {
    if (!selectedDate || !selectedServiceId || !selectedBarberId) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setIsFetchingSlots(true);
      try {
        const slots = await getAvailableTimeSlots(
          barbershopId,
          selectedDate,
          selectedServiceId,
          selectedBarberId,
        );
        setAvailableSlots(slots);
      } catch (error) {
        console.error("Erro ao buscar horários:", error);
        toast.error("Não foi possível carregar os horários disponíveis.");
      } finally {
        setIsFetchingSlots(false);
      }
    };

    fetchSlots();
    setValue("time", "");
  }, [
    selectedDate,
    selectedServiceId,
    selectedBarberId,
    setValue,
    barbershopId,
  ]);

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        const [hour, minute] = data.time.split(":").map(Number);
        const bookingDateTime = new Date(data.date);
        bookingDateTime.setHours(hour, minute, 0, 0);

        const result = await createBooking({
          barbershopId,
          serviceId: data.serviceId,
          barberId: data.barberId,
          date: bookingDateTime,
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          notes: data.notes,
        });

        if (result.success) {
          toast.success("Agendamento criado com sucesso!");
          reset();
          setAvailableSlots([]);
        } else {
          toast.error(result.error || "Ocorreu um erro ao agendar.");
        }
      } catch {
        toast.error("Ocorreu um erro inesperado. Tente novamente.");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="relative">
        <Button
          asChild
          size="icon"
          variant="outline"
          className="absolute left-4 top-4"
        >
          <Link href="/dashboard">
            <ChevronLeft size={20} />
          </Link>
        </Button>
        <CardTitle className="text-center">Agendamento Manual</CardTitle>
        <CardDescription className="text-center">
          Preencha os dados abaixo para criar um novo agendamento para um
          cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-lg font-semibold">Dados do Cliente</h3>
            <div>
              <label
                htmlFor="clientName"
                className="block text-sm font-medium mb-1"
              >
                Nome do Cliente
              </label>
              <Input
                id="clientName"
                placeholder="Ex: Carlos Pereira"
                {...register("clientName")}
              />
              {errors.clientName && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.clientName.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="clientPhone"
                className="block text-sm font-medium mb-1"
              >
                Telefone (Opcional)
              </label>
              <Input
                id="clientPhone"
                placeholder="(99) 99999-9999"
                {...register("clientPhone")}
              />
              {errors.clientPhone && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.clientPhone.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <h3 className="text-lg font-semibold">Detalhes do Agendamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="serviceId"
                  className="block text-sm font-medium mb-1"
                >
                  Serviço
                </label>
                <Controller
                  name="serviceId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="serviceId">
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.serviceId && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.serviceId.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="barberId"
                  className="block text-sm font-medium mb-1"
                >
                  Barbeiro
                </label>
                <Controller
                  name="barberId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="barberId">
                        <SelectValue placeholder="Selecione o barbeiro" />
                      </SelectTrigger>
                      <SelectContent>
                        {barbers.map((barber) => (
                          <SelectItem key={barber.id} value={barber.id}>
                            {barber.user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.barberId && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.barberId.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data</label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={`w-full justify-start text-left font-normal ${!field.value && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.date && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.date.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="time"
                  className="block text-sm font-medium mb-1"
                >
                  Horário
                </label>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={
                        !selectedDate ||
                        !selectedServiceId ||
                        !selectedBarberId ||
                        isFetchingSlots
                      }
                    >
                      <SelectTrigger id="time">
                        <SelectValue
                          placeholder={
                            isFetchingSlots
                              ? "Buscando..."
                              : "Selecione o horário"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isFetchingSlots ? (
                          <div className="flex items-center justify-center p-2">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Carregando...
                          </div>
                        ) : availableSlots.length > 0 ? (
                          availableSlots.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            Nenhum horário vago.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.time && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.time.message}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Descrição/Observação (Opcional)
              </label>
              <Textarea
                id="notes"
                placeholder="Ex: Cliente tem preferência pela máquina 2 na lateral."
                {...register("notes")}
              />
              {errors.notes && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Agendamento
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
