// app/dashboard/servicos/ServicosClientPage.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  PlusCircle,
  Edit,
  Trash2,
  Loader2,
  DollarSign,
  Clock,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createBarbershopService,
  updateBarbershopService,
  deleteBarbershopService,
} from "@/actions/service-actions";
import { uploadImage } from "@/actions/image-upload"; // Importa a server action de upload
import { Resolver } from "react-hook-form";

export type BarbershopServiceFromDB = {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  durationInMinutes: number;
  barbershopId: string;
};

const serviceFormSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(3, "Nome do serviço deve ter pelo menos 3 caracteres.")
    .max(100, "Nome do serviço deve ter no máximo 100 caracteres."),
  description: z
    .string()
    .min(10, "Descrição do serviço deve ter pelo menos 10 caracteres.")
    .max(500, "Descrição do serviço deve ter no máximo 500 caracteres."),
  price: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        const cleanedVal = val.replace(",", ".");
        return parseFloat(cleanedVal);
      }
      return val;
    },
    z
      .number()
      .min(0.01, "Preço deve ser um número positivo.")
      .max(9999.99, "Preço máximo R$9999.99")
      .refine((val) => !isNaN(val), { message: "Preço inválido." }),
  ),
  imageUrl: z
    .string()
    .url("URL da imagem inválida.")
    .min(5, "URL da imagem é obrigatória.")
    .max(2048, "URL da imagem muito longa."),
  durationInMinutes: z
    .number()
    .int("Duração deve ser um número inteiro.")
    .min(1, "Duração deve ser de pelo menos 1 minuto.")
    .max(240, "Duração máxima de 4 horas (240 minutos)."),
});

type ServiceFormInput = z.infer<typeof serviceFormSchema>;

export default function ServicosClientPage({
  initialServices,
}: {
  initialServices: BarbershopServiceFromDB[];
}) {
  const [services, setServices] =
    useState<BarbershopServiceFromDB[]>(initialServices);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] =
    useState<BarbershopServiceFromDB | null>(null);
  const [isSaving, setIsSaving] = useState(false); // Controla o loading de salvar/criar
  const [isUploading, setIsUploading] = useState(false); // Novo estado para o loading do upload
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null); // Estado para a prévia da imagem

  const form = useForm<ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema) as Resolver<ServiceFormInput>,
    defaultValues: {
      name: "",
      description: "",
      price: 0.01,
      imageUrl: "",
      durationInMinutes: 30,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    setServices(initialServices.map((service) => ({ ...service })));
  }, [initialServices]);

  useEffect(() => {
    if (editingService) {
      form.reset(
        {
          id: editingService.id,
          name: editingService.name,
          description: editingService.description,
          price: parseFloat(editingService.price),
          imageUrl: editingService.imageUrl,
          durationInMinutes: editingService.durationInMinutes,
        },
        { keepDefaultValues: false },
      );
      setImagePreviewUrl(editingService.imageUrl);
    } else {
      form.reset(
        {
          name: "",
          description: "",
          price: 0.01,
          imageUrl: "",
          durationInMinutes: 30,
        },
        { keepDefaultValues: false },
      );
      setImagePreviewUrl(null);
    }
    form.clearErrors();
  }, [editingService, form]);

  const handleOpenDialog = (service?: BarbershopServiceFromDB) => {
    setEditingService(service || null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    form.reset();
    form.clearErrors();
    setImagePreviewUrl(null);
  };

  const handleImageFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadImage(formData);

        if (result.success && result.imageUrl) {
          form.setValue("imageUrl", result.imageUrl, { shouldValidate: true });
          toast.success("Imagem carregada com sucesso!");
        } else {
          toast.error("Falha ao carregar imagem.", {
            description: "URL da imagem não retornada.",
          });
          form.setValue("imageUrl", "");
          setImagePreviewUrl(null);
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
        event.target.value = "";
      }
    },
    [form],
  );
  const onSubmit = async (data: ServiceFormInput) => {
    setIsSaving(true);
    try {
      if (editingService) {
        await updateBarbershopService(editingService.id, {
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          durationInMinutes: data.durationInMinutes,
        });
        toast.success("Serviço atualizado com sucesso!");
      } else {
        await createBarbershopService({
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          durationInMinutes: data.durationInMinutes,
        });
        toast.success("Serviço criado com sucesso!");
      }
      handleCloseDialog();
    } catch (error: unknown) {
      console.error("Erro ao salvar serviço:", error);
      let errorMessage = "Ocorreu um erro inesperado ao salvar o serviço.";
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
      toast.error("Erro ao salvar serviço", { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteBarbershopService(serviceId);
      toast.success("Serviço excluído com sucesso!");
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (error: unknown) {
      console.error("Erro ao excluir serviço:", error);
      let errorMessage = "Ocorreu um erro inesperado ao excluir o serviço.";
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
      toast.error("Erro ao excluir serviço", { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  if (!initialServices) {
    return null;
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto md:p-6 lg:p-8">
      {/* Voltar */}
      <Link href="/dashboard">
        <Button variant="ghost" className="flex items-center gap-2 text-white">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </Link>

      <Separator className="bg-white/10" />

      {/* Título e Botão de Adicionar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6" /> Gestão de Serviços
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie, edite e exclua os serviços oferecidos pela sua barbearia.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="flex items-center gap-2 w-full md:w-auto"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Editar Serviço" : "Adicionar Novo Serviço"}
              </DialogTitle>
              <DialogDescription>
                {editingService
                  ? "Altere os detalhes do serviço."
                  : "Preencha os detalhes do novo serviço."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Nome do Serviço */}
              <div>
                <Label htmlFor="name">Nome do Serviço</Label>
                <Input id="name" {...form.register("name")} className="mt-1" />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Descrição do Serviço */}
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  className="mt-1"
                />
                {form.formState.errors.description && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              {/* Preço e Duração */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    {...form.register("price", { valueAsNumber: true })}
                    className="mt-1"
                  />
                  {form.formState.errors.price && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.price.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="durationInMinutes">Duração (minutos)</Label>
                  <Input
                    id="durationInMinutes"
                    type="number"
                    {...form.register("durationInMinutes", {
                      valueAsNumber: true,
                    })}
                    className="mt-1"
                  />
                  {form.formState.errors.durationInMinutes && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.durationInMinutes.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Campo de Upload de Imagem */}
              <div className="space-y-2">
                <Label
                  htmlFor="imageUpload"
                  className="flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" /> Upload de Imagem
                </Label>
                <Input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange} // Usa o novo manipulador de upload
                  disabled={isUploading} // Desabilita enquanto o upload está ativo
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
                      className="w-32 h-32 object-cover rounded-md mx-auto border border-white/20"
                    />
                  </div>
                )}
                {form.watch("imageUrl") &&
                  !imagePreviewUrl && ( // Mostra a URL se não tiver prévia temporária
                    <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" />
                      <a
                        href={form.watch("imageUrl")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-blue-400 hover:underline"
                      >
                        {form.watch("imageUrl")}
                      </a>
                    </div>
                  )}

                {form.formState.errors.imageUrl && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.imageUrl.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isSaving || isUploading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving || isUploading}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : editingService ? (
                    "Salvar Alterações"
                  ) : (
                    "Criar Serviço"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Separator className="bg-white/10" />

      {/* Lista de Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center">
            Nenhum serviço cadastrado. Clique em Adicionar Novo Serviço para
            começar.
          </p>
        ) : (
          services.map((service) => (
            <Card
              key={service.id}
              className="bg-card text-card-foreground border-border shadow-md"
            >
              <CardHeader className="flex flex-row items-center space-x-4">
                <img
                  src={service.imageUrl}
                  alt={service.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />{" "}
                      {parseFloat(service.price).toFixed(2).replace(".", ",")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {service.durationInMinutes}{" "}
                      min
                    </span>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {service.description}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(service)}
                >
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(service.id)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
