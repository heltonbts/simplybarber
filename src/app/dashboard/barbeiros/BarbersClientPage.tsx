// app/dashboard/barbers/BarbersClientPage.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Loader2,
  Users,
  Mail,
  User,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { addBarber, removeBarber } from "@/actions/config-barber";

import type { BarberFromDB } from "./page";

const addBarberFormSchema = z.object({
  email: z.string().email("E-mail inválido.").min(1, "E-mail é obrigatório."),
});

type AddBarberFormInput = z.infer<typeof addBarberFormSchema>;

export default function BarbersClientPage({
  initialBarbers,
}: {
  initialBarbers: BarberFromDB[];
}) {
  const [barbers, setBarbers] = useState<BarberFromDB[]>(initialBarbers);
  const [isAddingBarber, setIsAddingBarber] = useState(false);
  const [isRemovingBarber, setIsRemovingBarber] = useState<string | null>(null); // ID do barbeiro sendo removido
  const [isAddBarberDialogOpen, setIsAddBarberDialogOpen] = useState(false); // Estado do modal

  const form = useForm<AddBarberFormInput>({
    resolver: zodResolver(addBarberFormSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    setBarbers(initialBarbers);
  }, [initialBarbers]);

  const handleAddBarber = async (data: AddBarberFormInput) => {
    setIsAddingBarber(true);
    try {
      const result = await addBarber(data.email);
      if (result.success && result.barber) {
        toast.success("Barbeiro adicionado com sucesso!");
        form.reset();
        setIsAddBarberDialogOpen(false);
      } else {
        toast.error("Falha ao adicionar barbeiro.", {
          description: "Resposta inesperada da ação.",
        });
      }
    } catch (error: unknown) {
      console.error("Erro ao adicionar barbeiro:", error);
      let errorMessage = "Ocorreu um erro inesperado ao adicionar o barbeiro.";
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
      toast.error("Erro ao adicionar barbeiro", { description: errorMessage });
    } finally {
      setIsAddingBarber(false);
    }
  };

  const handleRemoveBarber = async (barberId: string) => {
    setIsRemovingBarber(barberId);
    try {
      const result = await removeBarber(barberId);
      if (result.success) {
        toast.success("Barbeiro removido com sucesso!");
      } else {
        toast.error("Falha ao remover barbeiro.", {
          description: "Resposta inesperada da ação.",
        });
      }
    } catch (error: unknown) {
      console.error("Erro ao remover barbeiro:", error);
      let errorMessage = "Ocorreu um erro inesperado ao remover o barbeiro.";
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
      toast.error("Erro ao remover barbeiro", { description: errorMessage });
    } finally {
      setIsRemovingBarber(null);
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto md:p-6 lg:p-8">
      {/* Voltar */}
      <Link href="/dashboard">
        <Button variant="ghost" className="flex items-center gap-2 text-white">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </Link>

      <Separator className="bg-white/10" />

      {/* Título */}
      <div className="flex items-center gap-2">
        <Users className="w-6 h-6 text-white" />
        <h1 className="text-2xl font-bold text-white">Gestão de Barbeiros</h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Adicione ou remova os profissionais que trabalham em sua barbearia.
      </p>

      <Separator className="bg-white/10" />

      {/* Botão para Adicionar Barbeiro */}
      <div className="flex justify-end">
        <Dialog
          open={isAddBarberDialogOpen}
          onOpenChange={setIsAddBarberDialogOpen}
        >
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Adicionar Barbeiro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Barbeiro</DialogTitle>
              <DialogDescription>
                Informe o e-mail do usuário que você deseja adicionar como
                barbeiro. Ele precisa já ter uma conta em nosso sistema.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(handleAddBarber)}
              className="grid gap-4 py-4"
            >
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  className="col-span-3"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-red-500 text-sm text-right col-span-4">
                  {form.formState.errors.email.message}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={isAddingBarber}>
                  {isAddingBarber ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Barbeiros */}
      <Card className="bg-card text-card-foreground border-border shadow-md">
        <CardHeader>
          <CardTitle>Barbeiros da Barbearia</CardTitle>
          <CardDescription>
            Lista de todos os profissionais associados à sua barbearia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {barbers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="w-8 h-8 mx-auto mb-2" />
              <p>Nenhum barbeiro cadastrado ainda.</p>
              <p>Use o botão Adicionar Barbeiro para começar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {barbers.map((barber) => (
                <div
                  key={barber.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={barber.user.image || undefined}
                        alt={barber.user.name || "Barbeiro"}
                      />
                      <AvatarFallback>
                        {barber.user.name ? (
                          barber.user.name.charAt(0).toUpperCase()
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">
                        {barber.user.name || "Nome não disponível"}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {barber.user.email}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={isRemovingBarber === barber.id}
                      >
                        {isRemovingBarber === barber.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card text-card-foreground border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação removerá o barbeiro{" "}
                          <span className="font-bold text-white">
                            {barber.user.name || barber.user.email}
                          </span>{" "}
                          da sua barbearia. Ele não poderá mais ser associado a
                          agendamentos futuros. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-white border-border">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveBarber(barber.id)}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
