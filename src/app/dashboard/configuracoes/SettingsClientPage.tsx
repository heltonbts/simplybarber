"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  Info,
  Image as ImageIcon, // Renomeado Image para ImageIcon
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

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { updateBarbershopProfile } from "@/actions/config-barbershop";
import { uploadImage } from "@/actions/image-upload";

// Importa o tipo da barbearia do Server Component
import type { BarbershopFromDB } from "./page";

// --- Schema de Validação com Zod para as configurações da barbearia ---
const settingsFormSchema = z.object({
  name: z
    .string()
    .min(3, "Nome da barbearia deve ter pelo menos 3 caracteres.")
    .max(100, "Nome da barbearia deve ter no máximo 100 caracteres."),
  address: z
    .string()
    .min(10, "Endereço deve ter pelo menos 10 caracteres.")
    .max(200, "Endereço deve ter no máximo 200 caracteres."),
  // O campo 'phone' é uma string para o input, mas será convertido para array
  phone: z
    .string()
    .min(8, "Telefone deve ter pelo menos 8 dígitos.") // Validação básica para a string de input
    .max(50, "Telefones muito longos.")
    .refine((val) => /^[0-9,\s\(\)\-+]+$/.test(val), {
      // Permite números, vírgulas, espaços, (), -, +
      message:
        "Telefones inválidos. Use apenas números, vírgulas, espaços, '(', ')', '-' ou '+'.",
    })
    .optional() // Permite ser opcional (string vazia)
    .or(z.literal("")), // Garante que string vazia passe a validação
  description: z
    .string()
    .min(20, "Descrição deve ter pelo menos 20 caracteres.")
    .max(1000, "Descrição deve ter no máximo 1000 caracteres."),
  imageUrl: z
    .string()
    .url("URL da imagem inválida.")
    .min(5, "URL da imagem é obrigatória.")
    .max(2048, "URL da imagem muito longa."),
});

type SettingsFormInput = z.infer<typeof settingsFormSchema>;

export default function SettingsClientPage({
  initialBarbershop,
}: {
  initialBarbershop: BarbershopFromDB;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const form = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      description: "",
      imageUrl: "",
    },
    mode: "onBlur",
  });

  // Preenche o formulário com os dados iniciais da barbearia
  // Controla se o formulário já foi inicializado para evitar reset múltiplo
  const hasInitialized = useState({ current: false })[0];

  useEffect(() => {
    if (initialBarbershop && !hasInitialized.current) {
      form.reset(
        {
          name: initialBarbershop.name,
          address: initialBarbershop.address,
          phone: initialBarbershop.phone.join(", ") || "",
          description: initialBarbershop.description,
          imageUrl: initialBarbershop.imageUrl,
        },
        { keepDefaultValues: false },
      );
      setImagePreviewUrl(initialBarbershop.imageUrl);
      hasInitialized.current = true; // <-- só deixa resetar uma vez
    }
  }, [initialBarbershop, form, hasInitialized]);

  const handleImageFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 1. Exibir prévia imediata (Data URL)
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 2. Fazer o upload para o Vercel Blob
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadImage(formData); // Chama a Server Action de upload

        if (result.success && result.imageUrl) {
          form.setValue("imageUrl", result.imageUrl, { shouldValidate: true });
          toast.success("Imagem carregada com sucesso!");
        } else {
          toast.error("Falha ao carregar imagem.", {
            description: "URL da imagem não retornada.",
          });
          form.setValue("imageUrl", ""); // Limpa o campo se houver falha
          setImagePreviewUrl(null); // Limpa a prévia também
        }
      } catch (uploadError: unknown) {
        console.error("Erro no upload da imagem:", uploadError);
        let errorMessage = "Erro ao fazer upload da imagem.";
        if (uploadError instanceof Error) {
          errorMessage = uploadError.message;
        } else if (typeof uploadError === "string") {
          errorMessage = uploadError;
        } else if (
          typeof uploadError === "object" &&
          uploadError !== null &&
          "message" in uploadError &&
          typeof (uploadError as { message: unknown }).message === "string"
        ) {
          errorMessage = (uploadError as { message: string }).message;
        }
        toast.error("Falha no upload", { description: errorMessage });
        form.setValue("imageUrl", "");
        setImagePreviewUrl(null);
      } finally {
        setIsUploading(false);
        event.target.value = ""; // Limpa o valor do input file
      }
    },
    [form],
  );

  const onSubmit = async (data: SettingsFormInput) => {
    setIsSaving(true);
    try {
      // Converte a string de telefones do input para um array de strings
      // Filtra strings vazias resultantes de múltiplas vírgulas ou vírgulas no início/fim
      const phonesArray = data.phone
        ? data.phone
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
        : [];

      await updateBarbershopProfile({
        name: data.name,
        address: data.address,
        phone: phonesArray, // Passa como array para a Server Action
        description: data.description,
        imageUrl: data.imageUrl,
      });
      toast.success("Configurações da barbearia salvas com sucesso!");
    } catch (error: unknown) {
      console.error("Erro ao salvar configurações:", error);
      let errorMessage =
        "Ocorreu um erro inesperado ao salvar as configurações.";
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
      toast.error("Erro ao salvar configurações", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!initialBarbershop) {
    return null;
  }

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
        <Info className="w-6 h-6 text-white" />
        <h1 className="text-2xl font-bold text-white">
          Configurações da Barbearia
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Atualize as informações gerais e o perfil da sua barbearia.
      </p>

      <Separator className="bg-white/10" />

      <Card className="bg-card text-card-foreground border-border shadow-md">
        <CardHeader>
          <CardTitle>Informações do Perfil</CardTitle>
          <CardDescription>
            Estas informações serão visíveis para os clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Nome da Barbearia */}
            <div>
              <Label htmlFor="name">Nome da Barbearia</Label>
              <Input id="name" {...form.register("name")} className="mt-1" />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Endereço */}
            <div>
              <Label htmlFor="address">Endereço Completo</Label>
              <Textarea
                id="address"
                {...form.register("address")}
                className="mt-1 min-h-[80px]"
              />
              {form.formState.errors.address && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>

            {/* Telefone(s) */}
            <div>
              <Label htmlFor="phone">Telefone(s) de Contato</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                className="mt-1"
                placeholder="Ex: (XX) XXXX-XXXX, (YY) XXXX-YYYY"
              />
              {form.formState.errors.phone && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.phone.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Separe múltiplos telefones com vírgulas.
              </p>
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="description">Descrição da Barbearia</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                className="mt-1 min-h-[120px]"
              />
              {form.formState.errors.description && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Campo de Upload de Imagem */}
            <div className="space-y-2">
              <Label htmlFor="imageUpload" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Logo/Imagem Principal
              </Label>
              <Input
                id="imageUpload"
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                disabled={isUploading}
                className="mt-1"
              />
              {isUploading && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando
                  imagem...
                </p>
              )}
              {/* Prévia da imagem */}
              {imagePreviewUrl && (
                <div className="mt-2 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Prévia da Imagem:
                  </p>
                  <img
                    src={imagePreviewUrl}
                    alt="Prévia"
                    className="w-48 h-auto object-cover rounded-md mx-auto border border-white/20"
                  />
                </div>
              )}
              {/* Se houver erro de URL, mesmo após upload/edição */}
              {form.formState.errors.imageUrl && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.imageUrl.message}
                </p>
              )}
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isSaving || isUploading}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
