// prisma/seed.ts

// Importa o PrismaClient do local de saída customizado
import { PrismaClient, Prisma } from "../generated/prisma";

// Instancia o cliente
const prisma = new PrismaClient();

// Seus dados de barbearias e serviços (não precisam mudar)
const barbershopData = [
  {
    name: "Barbearia Vintage",
    address: "Rua da Barbearia, 123",
    imageUrl: "https://utfs.io/f/c97a2dc9-cf62-468b-a851-bfd2bdde775f-16p.png",
  },
  {
    name: "Corte & Estilo",
    address: "Avenida dos Cortes, 456",
    imageUrl: "https://utfs.io/f/45331760-899c-4b4b-910e-e00babb6ed81-16q.png",
  },
  // ... resto dos seus dados de barbearia
];

const servicesData = [
  {
    name: "Corte de Cabelo",
    description: "Estilo personalizado com as últimas tendências.",
    price: "50.00",
    imageUrl:
      "https://utfs.io/f/0ddfbd26-a424-43a0-aaf3-c3f1dc6be6d1-1kgxo7.png",
  },
  {
    name: "Barba",
    description: "Modelagem completa para destacar sua masculinidade.",
    price: "40.00",
    imageUrl:
      "https://utfs.io/f/e6bdffb6-24a9-455b-aba3-903c2c2b5bde-1jo6tu.png",
  },
  // ... resto dos seus dados de serviço
];

async function main() {
  console.log("Iniciando o processo de seed...");

  try {
    // 1. ORDEM CORRETA DE LIMPEZA DE DADOS
    // Limpa os "filhos" antes dos "pais" para não quebrar as constraints do banco
    console.log("Limpando dados antigos...");
    await prisma.booking.deleteMany();
    await prisma.barbershopService.deleteMany();
    await prisma.barbershop.deleteMany();
    await prisma.user.deleteMany();
    console.log("Dados antigos limpos com sucesso.");

    // 2. CRIAR UM USUÁRIO PARA SER O DONO DAS BARBEARIAS
    console.log("Criando usuário dono...");
    const ownerUser = await prisma.user.create({
      data: {
        name: "Admin FSW",
        email: "admin@fswbarber.com",
      },
    });
    console.log(`Usuário dono criado com ID: ${ownerUser.id}`);

    // 3. CRIAR AS BARBEARIAS E CONECTÁ-LAS AO DONO
    console.log("Criando novas barbearias e serviços...");
    for (const shop of barbershopData) {
      const barbershop = await prisma.barbershop.create({
        data: {
          name: shop.name,
          address: shop.address,
          imageUrl: shop.imageUrl,
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nisl eu nisl.",
          phone: ["(11) 98765-4321"],

          // ==========================================================
          // A MUDANÇA MAIS IMPORTANTE ESTÁ AQUI
          // Conectamos a barbearia que está sendo criada ao usuário 'dono'
          owner: {
            connect: {
              id: ownerUser.id,
            },
          },
          // ==========================================================
        },
      });

      // Criar os serviços para cada barbearia (sua lógica aqui está ótima)
      for (const service of servicesData) {
        await prisma.barbershopService.create({
          data: {
            name: service.name,
            description: service.description,
            price: new Prisma.Decimal(service.price),
            imageUrl: service.imageUrl,
            barbershopId: barbershop.id,
          },
        });
      }
    }

    // 4. (BÔNUS) CRIAR UM CLIENTE E UM AGENDAMENTO DE EXEMPLO
    console.log("Criando dados de exemplo para agendamento...");
    const clientUser = await prisma.user.create({
      data: {
        name: "Miguel Cliente",
        email: "miguel@cliente.com",
      },
    });

    const firstBarbershop = await prisma.barbershop.findFirst();
    const firstService = await prisma.barbershopService.findFirst({
      where: { barbershopId: firstBarbershop?.id },
    });

    if (clientUser && firstBarbershop && firstService) {
      await prisma.booking.create({
        data: {
          userId: clientUser.id,
          barbershopId: firstBarbershop.id,
          serviceId: firstService.id,
          date: new Date("2025-07-15T10:00:00.000Z"),
        },
      });
    }

    console.log("Seed executado com sucesso!");
  } catch (error) {
    console.error("Ocorreu um erro durante o processo de seed:", error);
    process.exit(1);
  } finally {
    console.log("Desconectando o Prisma Client...");
    await prisma.$disconnect();
  }
}

// Executa a função principal
main();
