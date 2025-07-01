"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { updatePhoneIfMissing } from "@/actions/get-number";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const phoneSchema = z
  .string()
  .length(15, "Por favor, preencha o número completo.");

export function CompleteRegisterForm({ email }: { email: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePhoneMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ""); // Remove tudo que não for dígito
    let maskedValue = "";

    if (rawValue.length > 0) {
      maskedValue = `(${rawValue.substring(0, 2)}`;
    }
    if (rawValue.length > 2) {
      maskedValue += `) ${rawValue.substring(2, 7)}`;
    }
    if (rawValue.length > 7) {
      maskedValue += `-${rawValue.substring(7, 11)}`;
    }

    e.target.value = maskedValue;
    setError(null);
  };

  const handleSubmit = (formData: FormData) => {
    const maskedPhone = formData.get("phone") as string;

    const validationResult = phoneSchema.safeParse(maskedPhone);
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }

    const phoneForBackend = `55${maskedPhone.replace(/\D/g, "")}`;

    startTransition(async () => {
      try {
        await updatePhoneIfMissing(email, phoneForBackend);

        await update();

        router.push("/");
      } catch (err) {
        console.error("Erro ao salvar número:", err);
        setError("Ocorreu um erro interno. Por favor, tente novamente.");
      }
    });
  };

  return (
    <Card className="w-full max-w-md bg-[#1a1a1a] border-none shadow-xl">
      <CardContent className="p-6">
        <form action={handleSubmit} className="flex flex-col gap-6">
          <div className="text-white space-y-1">
            <h1 className="text-2xl font-bold">Informe seu WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Precisamos do seu número para confirmar suas reservas.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Input
              name="phone"
              placeholder="(88) 91234-5678"
              className="bg-zinc-900 text-white placeholder:text-zinc-500"
              required
              disabled={isPending}
              onChange={handlePhoneMask}
              maxLength={15}
            />
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>

          <Button
            type="submit"
            className="bg-[#8257E5] hover:bg-[#6f48c9] text-white w-full rounded-xl py-2 text-lg font-semibold"
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
