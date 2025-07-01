import { PrismaClient, Prisma } from "../generated/prisma";

const prisma = new PrismaClient();

const barbershopData = [
  {
    name: "Barbearia Vintage",
    address: "Rua da Barbearia, 123",
    imageUrl: "https://i.imgur.com/9F3G6mD.jpg",
    phone: ["(11) 98765-4321"],
  },
  {
    name: "Corte & Estilo",
    address: "Avenida dos Cortes, 456",
    imageUrl: "https://i.imgur.com/2zP1aBn.jpg",
    phone: ["(11) 98765-4322"],
  },
  {
    name: "A Navalha Dourada",
    address: "Praça Central, 789",
    imageUrl: "https://i.imgur.com/Wx5kdEQ.jpg",
    phone: ["(11) 98765-4323"],
  },
  {
    name: "Barber Club",
    address: "Travessa do Barbeiro, 101",
    imageUrl: "https://i.imgur.com/4dT0LQR.jpg",
    phone: ["(11) 98765-4324"],
  },
  {
    name: "O Fio da Navalha",
    address: "Rua das Tesouras, 202",
    imageUrl: "https://i.imgur.com/l6sdtzY.jpg",
    phone: ["(11) 98765-4325"],
  },
];

const servicesData = [
  {
    name: "Corte de Cabelo",
    description: "Estilo personalizado com as últimas tendências.",
    price: "50.00",
    imageUrl: "https://i.imgur.com/WtP1ftu.jpg",
  },
  {
    name: "Barba",
    description: "Modelagem completa para destacar sua masculinidade.",
    price: "40.00",
    imageUrl: "https://i.imgur.com/okG6HRk.jpg",
  },
  {
    name: "Cabelo e Barba",
    description: "Combo completo: corte de cabelo e barba modelada.",
    price: "80.00",
    imageUrl: "https://i.imgur.com/VXbSPbw.jpg",
  },
  {
    name: "Limpeza de Pele",
    description: "Remoção de impurezas e hidratação facial.",
    price: "60.00",
    imageUrl: "https://i.imgur.com/9TSiWqY.jpg",
  },
  {
    name: "Massagem Capilar",
    description: "Relaxamento e estímulo do couro cabeludo.",
    price: "30.00",
    imageUrl: "https://i.imgur.com/RzWGgdb.jpg",
  },
  {
    name: "Alisamento",
    description: "Tratamento para cabelo liso e sem frizz.",
    price: "120.00",
    imageUrl: "https://i.imgur.com/En0nXvK.jpg",
  },
];

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
    // Se você tiver um campo 'password' no seu User, e quiser um hash:
    // const hashedPassword = await hash('suaSenhaSeguraAqui', 10);
    const ownerUser = await prisma.user.create({
      data: {
        name: "Admin FSW",
        email: "admin@fswbarber.com",
        // password: hashedPassword, // Descomente se tiver senha
        phone: "5588999999999", // Telefone de exemplo para o admin
      },
    });
    console.log(`Usuário dono criado com ID: ${ownerUser.id}`);

    console.log("Criando novas barbearias e seus serviços...");
    for (const shop of barbershopData) {
      const barbershop = await prisma.barbershop.create({
        data: {
          name: shop.name,
          address: shop.address,
          imageUrl: shop.imageUrl,
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nisl eu nisl.",
          phone: shop.phone,
          owner: {
            connect: {
              id: ownerUser.id,
            },
          },
        },
      });

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
      console.log(`Barbearia "${barbershop.name}" e seus serviços criados.`);
    }

    console.log("Criando dados de exemplo para agendamento...");
    const clientUser = await prisma.user.create({
      data: {
        name: "Miguel Cliente",
        email: "miguel@cliente.com",
        phone: "55889981412297", // Telefone do cliente de teste
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
