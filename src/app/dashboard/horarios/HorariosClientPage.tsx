// app/dashboard/horarios/HorariosClientPage.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  Utensils,
  Edit,
  Save,
  CalendarDays,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { saveWorkingHours } from "@/actions/save-working-hours"; // Certifique-se de que este import está correto

import type { WorkingHour } from "./page";

const diasDaSemanaDisplay = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const weekDayOrderForUI = [1, 2, 3, 4, 5, 6, 0];

export default function HorariosClientPage({
  initialData,
}: {
  initialData: WorkingHour[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setWorkingHours(initialData.map((day) => ({ ...day })));
  }, [initialData]);

  const validateHours = useCallback((hours: WorkingHour[]): string | null => {
    for (const dia of hours) {
      if (dia.isOpen) {
        if (!dia.openTime || !dia.closeTime) {
          return `Preencha os horários de abertura e fechamento para ${diasDaSemanaDisplay[dia.weekDay]}.`;
        }

        const parseTime = (time: string) => parseInt(time.replace(":", ""));

        const openTimeNum = parseTime(dia.openTime);
        const closeTimeNum = parseTime(dia.closeTime);

        if (openTimeNum >= closeTimeNum) {
          return `O horário de abertura (${dia.openTime}) deve ser anterior ao de fechamento (${dia.closeTime}) para ${diasDaSemanaDisplay[dia.weekDay]}.`;
        }

        if (dia.lunchStart && dia.lunchEnd) {
          const lunchStartNum = parseTime(dia.lunchStart);
          const lunchEndNum = parseTime(dia.lunchEnd);

          if (lunchStartNum >= lunchEndNum) {
            return `O início do almoço (${dia.lunchStart}) deve ser anterior ao fim do almoço (${dia.lunchEnd}) para ${diasDaSemanaDisplay[dia.weekDay]}.`;
          }
          if (lunchStartNum < openTimeNum || lunchEndNum > closeTimeNum) {
            return `O horário de almoço (${dia.lunchStart}-${dia.lunchEnd}) deve estar DENTRO do horário de funcionamento (${dia.openTime}-${dia.closeTime}) para ${diasDaSemanaDisplay[dia.weekDay]}.`;
          }
        } else if (
          (dia.lunchStart && !dia.lunchEnd) ||
          (!dia.lunchStart && dia.lunchEnd)
        ) {
          return `Preencha ambos os horários de início e fim do almoço para ${diasDaSemanaDisplay[dia.weekDay]}, ou deixe ambos vazios.`;
        }
      }
    }
    return null;
  }, []);

  const handleToggleEdit = () => {
    if (isEditing) {
      setWorkingHours(initialData.map((day) => ({ ...day })));
    }
    setIsEditing(!isEditing);
  };

  const handleChange = useCallback(
    (weekDay: number, field: keyof WorkingHour, value: string | boolean) => {
      setWorkingHours((prevHours) =>
        prevHours.map((day) => {
          if (day.weekDay === weekDay) {
            if (
              ["openTime", "closeTime", "lunchStart", "lunchEnd"].includes(
                field as string,
              ) &&
              value === ""
            ) {
              return { ...day, [field]: null };
            }
            return { ...day, [field]: value };
          }
          return day;
        }),
      );
    },
    [],
  );

  const handleSave = async () => {
    const validationError = validateHours(workingHours);
    if (validationError) {
      toast.error("Erro de Validação", { description: validationError });
      return;
    }

    setIsLoading(true);
    try {
      const dataToSave = workingHours.map((hour) => ({
        ...hour,
        openTime: hour.isOpen ? hour.openTime : "00:00",
        closeTime: hour.isOpen ? hour.closeTime : "00:00",
        lunchStart: hour.isOpen ? hour.lunchStart || null : null,
        lunchEnd: hour.isOpen ? hour.lunchEnd || null : null,
      }));

      await saveWorkingHours(dataToSave as WorkingHour[]);

      toast.success("Horários salvos com sucesso!");
      setIsEditing(false);
    } catch (error: unknown) {
      console.error("Erro ao salvar horários:", error);

      let errorMessage: string =
        "Ocorreu um erro inesperado. Por favor, tente novamente.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
      ) {
        errorMessage = (error as { message: string }).message;
      }

      toast.error("Erro ao salvar horários", {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sortedWorkingHours = [...workingHours].sort((a, b) => {
    const indexA = weekDayOrderForUI.indexOf(a.weekDay);
    const indexB = weekDayOrderForUI.indexOf(b.weekDay);
    return indexA - indexB;
  });

  if (!initialData || initialData.length === 0) {
    return null;
  }

  return (
    <div className="p-4 space-y-6 max-w-xl mx-auto md:p-6 lg:p-8">
      {/* Voltar */}
      <Link href="/dashboard">
        <Button variant="ghost" className="flex items-center gap-2 text-white">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </Link>

      <Separator className="bg-white/10" />

      {/* Título e Botão de Edição */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6" /> Horário de Funcionamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os horários de abertura e fechamento da sua barbearia.
          </p>
        </div>
        <Button
          onClick={handleToggleEdit}
          variant="outline"
          className="text-white flex items-center gap-2 w-full md:w-auto"
        >
          {isEditing ? (
            <Save className="w-4 h-4" />
          ) : (
            <Edit className="w-4 h-4" />
          )}
          {isEditing ? "Salvar Alterações" : "Editar Horários"}
        </Button>
      </div>

      <Separator className="bg-white/10" />

      {/* Lista de dias / Formulário de Edição */}
      <div className="space-y-4">
        {sortedWorkingHours.map((dia) => (
          <div
            key={dia.weekDay}
            className="border border-white/10 bg-white/5 rounded-xl p-4 text-white space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              {/* Usa o array de exibição para o nome do dia */}
              <h2 className="text-lg font-semibold">
                {diasDaSemanaDisplay[dia.weekDay]}
              </h2>
              {isEditing && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`isOpen-${dia.weekDay}`}
                    checked={dia.isOpen}
                    onCheckedChange={(checked) =>
                      handleChange(dia.weekDay, "isOpen", checked)
                    } // Passa weekDay como ID
                  />
                  <Label htmlFor={`isOpen-${dia.weekDay}`}>
                    {dia.isOpen ? "Aberto" : "Fechado"}
                  </Label>
                </div>
              )}
            </div>

            {isEditing ? (
              // Modo de Edição
              dia.isOpen ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor={`openTime-${dia.weekDay}`}
                      className="text-xs text-muted-foreground"
                    >
                      Abertura
                    </Label>
                    <Input
                      id={`openTime-${dia.weekDay}`}
                      type="time"
                      value={dia.openTime || ""}
                      onChange={(e) =>
                        handleChange(dia.weekDay, "openTime", e.target.value)
                      }
                      className="bg-white/10 text-white border-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`closeTime-${dia.weekDay}`}
                      className="text-xs text-muted-foreground"
                    >
                      Fechamento
                    </Label>
                    <Input
                      id={`closeTime-${dia.weekDay}`}
                      type="time"
                      value={dia.closeTime || ""}
                      onChange={(e) =>
                        handleChange(dia.weekDay, "closeTime", e.target.value)
                      }
                      className="bg-white/10 text-white border-white/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Horário de Almoço (opcional)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor={`lunchStart-${dia.weekDay}`}
                          className="text-xs text-muted-foreground"
                        >
                          Início do Almoço
                        </Label>
                        <Input
                          id={`lunchStart-${dia.weekDay}`}
                          type="time"
                          value={dia.lunchStart || ""}
                          onChange={(e) =>
                            handleChange(
                              dia.weekDay,
                              "lunchStart",
                              e.target.value,
                            )
                          }
                          className="bg-white/10 text-white border-white/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor={`lunchEnd-${dia.weekDay}`}
                          className="text-xs text-muted-foreground"
                        >
                          Fim do Almoço
                        </Label>
                        <Input
                          id={`lunchEnd-${dia.weekDay}`}
                          type="time"
                          value={dia.lunchEnd || ""}
                          onChange={(e) =>
                            handleChange(
                              dia.weekDay,
                              "lunchEnd",
                              e.target.value,
                            )
                          }
                          className="bg-white/10 text-white border-white/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic mt-2">
                  Barbearia fechada neste dia.
                </p>
              )
            ) : // Modo de Visualização
            dia.isOpen ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  Das {dia.openTime} às {dia.closeTime}
                </p>
                {dia.lunchStart && dia.lunchEnd && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Utensils className="w-4 h-4" />
                    Almoço: {dia.lunchStart} às {dia.lunchEnd}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Fechado</p>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full mt-6 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Confirmar e Salvar
            </>
          )}
        </Button>
      )}
    </div>
  );
}
