"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BookingDetails, BarberWithUser } from "@/actions/create-booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { BarbershopService } from "../../../generated/prisma";
import { createManualBookingAction } from "@/actions/create-booking-manual";

const bookingFormSchema = z.object({
  clientName: z.string().min(3, "Nome do cliente é obrigatório."),
  clientPhone: z.string().optional(),
  serviceId: z.string({ required_error: "Selecione um serviço." }),
  barberId: z.string({ required_error: "Selecione um barbeiro." }),
  date: z.date({ required_error: "Selecione uma data." }).nullable(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora inválida (formato HH:MM)."),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface ManualBookingFormProps {
  barbershopId: string;
  barbers: BarberWithUser[];
  services: BarbershopService[];
  initialData?: BookingDetails | null;
  onFinished: () => void;
}

export function ManualBookingForm({
  barbershopId,
  barbers,
  services,
  initialData,
  onFinished,
}: ManualBookingFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      clientName: initialData?.clientName ?? "",
      clientPhone: initialData?.clientPhone ?? "",
      serviceId: initialData?.serviceId ?? "",
      barberId: initialData?.barberId ?? "",
      date: initialData ? new Date(initialData.date) : null,
      time: initialData ? format(new Date(initialData.date), "HH:mm") : "",
      notes: initialData?.notes ?? "",
    },
  });

  const onSubmit = async (data: BookingFormValues) => {
    if (!data.date || !data.time) {
      toast.error("Por favor, selecione uma data e um horário.");
      return;
    }

    try {
      // 1. Apenas pegue a data e a hora como strings, sem criar ou manipular objetos Date.
      const selectedDate = format(data.date, "yyyy-MM-dd");
      const selectedTime = data.time;

      if (initialData) {
        // A mesma lógica se aplica aqui: envie as strings para a sua função de update.
        // await updateBooking({ ... });
        toast.info("A lógica de atualização também precisa ser revisada.");
      } else {
        // 2. Envie as strings diretamente para a sua server action.
        // O servidor fará o trabalho pesado de converter o fuso horário corretamente.
        await createManualBookingAction(
          barbershopId,
          data.barberId,
          data.serviceId,
          selectedDate, // <-- 4º argumento
          selectedTime, // <-- 5º argumento
          data.clientName, // <-- 6º argumento
          data.clientPhone, // <-- 7º argumento
          data.notes, // <-- 8º argumento (opcional)
          null, // <-- 9º argumento (userId), agora na posição correta.
        );

        toast.success("Agendamento criado com sucesso!");
      }

      onFinished(); // Chamado apenas em caso de sucesso.
    } catch (error) {
      // 3. Um único `catch` para lidar com todos os erros da operação.
      const errorMessage =
        error instanceof Error ? error.message : "Ocorreu um erro.";
      toast.error(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
      <div>
        <Label htmlFor="clientName">Nome do Cliente</Label>
        <Input
          id="clientName"
          {...register("clientName")}
          placeholder="Ex: João Silva"
        />
        {errors.clientName && (
          <p className="text-sm text-red-500 mt-1">
            {errors.clientName.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="clientPhone">Telefone (Opcional)</Label>
        <Input
          id="clientPhone"
          {...register("clientPhone")}
          placeholder="(99) 99999-9999"
        />
      </div>

      <Controller
        name="serviceId"
        control={control}
        render={({ field }) => (
          <div>
            <Label>Serviço</Label>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.serviceId && (
              <p className="text-sm text-red-500 mt-1">
                {errors.serviceId.message}
              </p>
            )}
          </div>
        )}
      />

      <Controller
        name="barberId"
        control={control}
        render={({ field }) => (
          <div>
            <Label>Barbeiro</Label>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o barbeiro" />
              </SelectTrigger>
              <SelectContent>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.barberId && (
              <p className="text-sm text-red-500 mt-1">
                {errors.barberId.message}
              </p>
            )}
          </div>
        )}
      />

      <div className="flex gap-4">
        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <div className="w-full">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value instanceof Date
                      ? format(field.value, "PPP", { locale: ptBR })
                      : "Escolha uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.value ?? undefined}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.date.message}
                </p>
              )}
            </div>
          )}
        />
        <div className="w-1/3">
          <Label htmlFor="time">Hora</Label>
          <Input id="time" {...register("time")} placeholder="14:30" />
          {errors.time && (
            <p className="text-sm text-red-500 mt-1">{errors.time.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Observações (Opcional)</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Ex: Cabelo mais curto nas laterais."
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : initialData ? (
          "Salvar Alterações"
        ) : (
          "Criar Agendamento"
        )}
      </Button>
    </form>
  );
}
