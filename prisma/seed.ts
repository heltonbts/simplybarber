// prisma/seed.ts

import { PrismaClient, Prisma } from "../generated/prisma";
// import { hash } from 'bcryptjs'; // Descomente se for usar hash de senha

const prisma = new PrismaClient();

// =========================================================================
// SUAS URLS EXATAS DO UTF.IO PARA BARBEARIAS E SERVIÇOS
// =========================================================================
const allUtfsImages = [
  "https://utfs.io/f/c97a2dc9-cf62-468b-a851-bfd2bdde775f-16p.png",
  "https://utfs.io/f/45331760-899c-4b4b-910e-e00babb6ed81-16q.png",
  "https://utfs.io/f/5832df58-cfd7-4b3f-b102-42b7e150ced2-16r.png",
  "https://utfs.io/f/7e309eaa-d722-465b-b8b6-76217404a3d3-16s.png",
  "https://utfs.io/f/178da6b6-6f9a-424a-be9d-a2feb476eb36-16t.png",
  "https://utfs.io/f/2f9278ba-3975-4026-af46-64af78864494-16u.png",
  "https://utfs.io/f/988646ea-dcb6-4f47-8a03-8d4586b7bc21-16v.png",
  "https://utfs.io/f/60f24f5c-9ed3-40ba-8c92-0cd1dcd043f9-16w.png",
  "https://utfs.io/f/f64f1bd4-59ce-4ee3-972d-2399937eeafc-16x.png",
  "https://utfs.io/f/e995db6d-df96-4658-99f5-11132fd931e1-17j.png",
  "https://utfs.io/f/3bcf33fc-988a-462b-8b98-b811ee2bbd71-17k.png",
  "https://utfs.io/f/5788be0e-2307-4bb4-b603-d9dd237950a2-17l.png",
  "https://utfs.io/f/6b0888f8-b69f-4be7-a13b-52d1c0c9cab2-17m.png",
  "https://utfs.io/f/ef45effa-415e-416d-8c4a-3221923cd10f-17n.png",
  "https://utfs.io/f/ef45effa-415e-416d-8c4a-3221923cd10f-17n.png", // Repetida, como na sua lista
  "https://utfs.io/f/a55f0f39-31a0-4819-8796-538d68cc2a0f-17o.png",
  "https://utfs.io/f/5c89f046-80cd-4443-89df-211de62b7c2a-17p.png",
  "https://utfs.io/f/23d9c4f7-8bdb-40e1-99a5-f42271b7404a-17q.png",
  "https://utfs.io/f/9f0847c2-d0b8-4738-a673-34ac2b9506ec-17r.png",
  "https://utfs.io/f/07842cfb-7b30-4fdc-accc-719618dfa1f2-17s.png",
  "https://utfs.io/f/0522fdaf-0357-4213-8f52-1d83c3dcb6cd-18e.png",
];

// Nomes e endereços fictícios (mantidos para preencher as 15 barbearias)
const creativeNames = [
  "Barbearia Vintage",
  "Corte & Estilo",
  "Barba & Navalha",
  "The Dapper Den",
  "Cabelo & Cia.",
  "Machado & Tesoura",
  "Barbearia Elegance",
  "Aparência Impecável",
  "Estilo Urbano",
  "Estilo Clássico",
  "O Barbeiro Real",
  "Espelho Mágico",
  "Tesoura de Ouro",
  "Cavalheiros Club",
  "Barber House Premium",
];

const addresses = [
  "Rua da Barbearia, 123",
  "Avenida dos Cortes, 456",
  "Praça da Barba, 789",
  "Travessa da Navalha, 101",
  "Alameda dos Estilos, 202",
  "Estrada do Machado, 303",
  "Avenida Elegante, 404",
  "Praça da Aparência, 505",
  "Rua Urbana, 606",
  "Avenida Clássica, 707",
  "Beco do Rei, 808",
  "Praça do Espelho, 909",
  "Rua da Riqueza, 1010",
  "Avenida dos Sonhos, 1111",
  "Praça do Charme, 1212",
];

// =========================================================================
// DADOS DE SERVIÇOS (com as URLs utfs.io que você forneceu para serviços)
// =========================================================================
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
  {
    name: "Pézinho",
    description: "Acabamento perfeito para um visual renovado.",
    price: 35.0,
    imageUrl:
      "https://utfs.io/f/8a457cda-f768-411d-a737-cdb23ca6b9b5-b3pegf.png",
  },
  {
    name: "Sobrancelha",
    description: "Expressão acentuada com modelagem precisa.",
    price: 20.0,
    imageUrl:
      "https://utfs.io/f/2118f76e-89e4-43e6-87c9-8f157500c333-b0ps0b.png",
  },
  {
    name: "Massagem",
    description: "Relaxe com uma massagem revigorante.",
    price: 50.0,
    imageUrl:
      "https://utfs.io/f/c4919193-a675-4c47-9f21-ebd86d1c8e6a-4oen2a.png",
  },
  {
    name: "Hidratação",
    description: "Hidratação profunda para cabelo e barba.",
    price: 25.0,
    imageUrl:
      "https://utfs.io/f/8a457cda-f768-411d-a737-cdb23ca6b9b5-b3pegf.png", // Usando a mesma URL do pézinho, ou forneça uma diferente se tiver
  },
];

// =========================================================================
// LÓGICA PRINCIPAL DO SEEDING
// =========================================================================

async function main() {
  console.log("Iniciando o processo de seed...");

  try {
    console.log("Limpando dados antigos...");
    await prisma.booking.deleteMany();
    await prisma.barbershopService.deleteMany();
    await prisma.barbershop.deleteMany();
    await prisma.user.deleteMany();
    console.log("Dados antigos limpos com sucesso.");

    console.log("Criando usuário dono...");
    const ownerUser = await prisma.user.create({
      data: {
        name: "Admin FSW",
        email: "admin@fswbarber.com",
        phone: "5588999999999",
      },
    });
    console.log(`Usuário dono criado com ID: ${ownerUser.id}`);

    console.log("Criando novas barbearias e seus serviços...");
    const NUMBER_OF_BARBERSHOPS = 15;
    const numberOfAvailableImages = allUtfsImages.length; // Total de URLs que você forneceu

    for (let i = 0; i < NUMBER_OF_BARBERSHOPS; i++) {
      // Pega uma URL da lista, ciclando se necessário
      const imageUrlForBarbershop = allUtfsImages[i % numberOfAvailableImages];
      const name = creativeNames[i % creativeNames.length]; // Cicla pelos nomes
      const address = addresses[i % addresses.length]; // Cicla pelos endereços

      const barbershop = await prisma.barbershop.create({
        data: {
          name: `${name} #${i + 1}`, // Adiciona um número para diferenciar
          address: address,
          imageUrl: imageUrlForBarbershop,
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nisl eu nisl.",
          phone: ["(11) 99999-9999", "(11) 99999-9999"],
          owner: {
            connect: {
              id: ownerUser.id,
            },
          },
        },
      });

      // Cria os serviços para cada barbearia, usando as URLs de serviço que você forneceu
      for (let j = 0; j < servicesData.length; j++) {
        const service = servicesData[j];
        await prisma.barbershopService.create({
          data: {
            name: service.name,
            description: service.description,
            price: new Prisma.Decimal(service.price),
            imageUrl: service.imageUrl, // Usa a URL específica do serviço
            barbershopId: barbershop.id,
          },
        });
      }
      console.log(
        `Barbearia "${barbershop.name}" e seus ${servicesData.length} serviços criados.`,
      );
    }

    console.log("Criando dados de exemplo para agendamento...");
    const clientUser = await prisma.user.create({
      data: {
        name: "Miguel Cliente",
        email: "miguel@cliente.com",
        phone: "55889981412297",
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
      console.log("Agendamento de exemplo criado.");
    } else {
      console.log(
        "Não foi possível criar agendamento de exemplo (barbearia/serviço/cliente não encontrados).",
      );
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

main();
