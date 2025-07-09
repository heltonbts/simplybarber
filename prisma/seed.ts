/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const ownerId = "cmcnikc8b0000ju043ytbwkxg";

  // Verificar se barbearia já existe para evitar duplicação
  const existingBarbershop = await prisma.barbershop.findFirst({
    where: { ownerId },
  });

  if (existingBarbershop) {
    console.log("Barbearia já existe para esse ownerId. Abortando seed.");
    return;
  }

  // Criar a barbearia
  const barbershop = await prisma.barbershop.create({
    data: {
      name: "Barbearia do Seed",
      address: "Rua Exemplo, 123",
      phone: ["+5585999999999"],
      description: "A melhor barbearia de testes da cidade.",
      imageUrl: "https://via.placeholder.com/300",
      ownerId,
    },
  });

  // Criar barbeiro vinculado
  const barber = await prisma.barber.create({
    data: {
      userId: ownerId,
      barbershopId: barbershop.id,
    },
  });

  // Criar horário de funcionamento (segunda-feira)
  await prisma.barbershopWorkingHour.create({
    data: {
      barbershopId: barbershop.id,
      weekDay: 1,
      isOpen: true,
      openTime: "09:00",
      closeTime: "18:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    },
  });

  // Criar um serviço
  await prisma.barbershopService.create({
    data: {
      barbershopId: barbershop.id,
      name: "Corte Tradicional",
      description: "Corte clássico e bem feito.",
      price: 39.9,
      imageUrl: "https://via.placeholder.com/300",
      durationInMinutes: 30,
    },
  });

  console.log("Seed concluída com sucesso 🚀");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
