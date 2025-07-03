import { PrismaClient, Prisma } from "../generated/prisma";
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando seed...");

  // Limpa os dados anteriores em ordem segura
  await prisma.booking.deleteMany();
  await prisma.barbershopService.deleteMany();
  await prisma.barbershopWorkingHour.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.barbershop.deleteMany();
  await prisma.user.deleteMany();

  // Cria dono da barbearia
  const owner = await prisma.user.create({
    data: {
      name: "Admin FSW",
      email: "admin@fswbarber.com",
    },
  });

  // Cria barbearia
  const barbershop = await prisma.barbershop.create({
    data: {
      name: "Barbearia Estilo FSW",
      address: "Rua dos Devs, 101",
      description: "A barbearia ideal para desenvolvedores!",
      imageUrl:
        "https://utfs.io/f/ef45effa-415e-416d-8c4a-3221923cd10f-17n.png",
      phone: ["(11) 99999-9999"],
      ownerId: owner.id,
    },
  });

  // Cria barbeiros (usuarios + barber)
  const barberUsers = await Promise.all(
    ["Lucas Barber", "João Corte", "Rafa Blade"].map((name, index) =>
      prisma.user.create({
        data: {
          name,
          email: `barber${index + 1}@fswbarber.com`,
        },
      }),
    ),
  );

  const barbers = await Promise.all(
    barberUsers.map((user) =>
      prisma.barber.create({
        data: {
          userId: user.id,
          barbershopId: barbershop.id,
        },
      }),
    ),
  );

  // Cria serviços
  const servicesData = [
    {
      name: "Corte",
      description: "Corte personalizado",
      price: new Prisma.Decimal(60),
      imageUrl:
        "https://utfs.io/f/0ddfbd26-a424-43a0-aaf3-c3f1dc6be6d1-1kgxo7.png",
      durationInMinutes: 30,
    },
    {
      name: "Barba",
      description: "Barba com toalha quente",
      price: new Prisma.Decimal(40),
      imageUrl:
        "https://utfs.io/f/e6bdffb6-24a9-455b-aba3-903c2c2b5bde-1jo6tu.png",
      durationInMinutes: 20,
    },
  ];

  const services = await Promise.all(
    servicesData.map((s) =>
      prisma.barbershopService.create({
        data: {
          ...s,
          barbershopId: barbershop.id,
        },
      }),
    ),
  );

  // Cria horários de funcionamento
  for (let i = 0; i < 7; i++) {
    await prisma.barbershopWorkingHour.create({
      data: {
        barbershopId: barbershop.id,
        weekDay: i,
        isOpen: i < 6, // fechado no domingo
        openTime: "09:00",
        closeTime: "18:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
      },
    });
  }

  // Cria cliente e agendamento
  const client = await prisma.user.create({
    data: {
      name: "Cliente Teste",
      email: "cliente@teste.com",
      phone: "(11) 98888-8888",
    },
  });

  await prisma.booking.create({
    data: {
      userId: client.id,
      barbershopId: barbershop.id,
      serviceId: services[0].id,
      barberId: barbers[0].id,
      date: new Date("2025-07-15T14:00:00.000Z"),
      clientName: client.name,
      clientPhone: client.phone!,
      notes: "Corte degradê.",
    },
  });

  console.log("✅ Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
