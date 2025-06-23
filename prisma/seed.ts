// Importa o PrismaClient do local de saída customizado, como definido no seu schema.prisma
import { PrismaClient, Prisma } from "../generated/prisma";

// Instancia o cliente
const prisma = new PrismaClient();

// Dados para o seed
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
  {
    name: "Barba & Navalha",
    address: "Praça da Barba, 789",
    imageUrl: "https://utfs.io/f/5832df58-cfd7-4b3f-b102-42b7e150ced2-16r.png",
  },
  {
    name: "The Dapper Den",
    address: "Travessa da Navalha, 101",
    imageUrl: "https://utfs.io/f/7e309eaa-d722-465b-b8b6-76217404a3d3-16s.png",
  },
  {
    name: "Cabelo & Cia.",
    address: "Alameda dos Estilos, 202",
    imageUrl: "https://utfs.io/f/178da6b6-6f9a-424a-be9d-a2feb476eb36-16t.png",
  },
  {
    name: "Machado & Tesoura",
    address: "Estrada do Machado, 303",
    imageUrl: "https://utfs.io/f/2f9278ba-3975-4026-af46-64af78864494-16u.png",
  },
  {
    name: "Barbearia Elegance",
    address: "Avenida Elegante, 404",
    imageUrl: "https://utfs.io/f/988646ea-dcb6-4f47-8a03-8d4586b7bc21-16v.png",
  },
  {
    name: "Aparência Impecável",
    address: "Praça da Aparência, 505",
    imageUrl: "https://utfs.io/f/60f24f5c-9ed3-40ba-8c92-0cd1dcd043f9-16w.png",
  },
  {
    name: "Estilo Urbano",
    address: "Rua Urbana, 606",
    imageUrl: "https://utfs.io/f/f64f1bd4-59ce-4ee3-972d-2399937eeafc-16x.png",
  },
  {
    name: "Estilo Clássico",
    address: "Avenida Clássica, 707",
    imageUrl: "https://utfs.io/f/e995db6d-df96-4658-99f5-11132fd931e1-17j.png",
  },
];

const servicesData = [
  {
    name: "Corte de Cabelo",
    description: "Estilo personalizado com as últimas tendências.",
    price: "50.00", // Preço como STRING para garantir compatibilidade com o tipo Decimal
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
    price: "35.00",
    imageUrl:
      "https://utfs.io/f/8a457cda-f768-411d-a737-cdb23ca6b9b5-b3pegf.png",
  },
  {
    name: "Sobrancelha",
    description: "Expressão acentuada com modelagem precisa.",
    price: "20.00",
    imageUrl:
      "https://utfs.io/f/2118f76e-89e4-43e6-87c9-8f157500c333-b0ps0b.png",
  },
  {
    name: "Massagem",
    description: "Relaxe com uma massagem revigorante.",
    price: "50.00",
    imageUrl:
      "https://utfs.io/f/c4919193-a675-4c47-9f21-ebd86d1c8e6a-4oen2a.png",
  },
  {
    name: "Hidratação",
    description: "Hidratação profunda para cabelo e barba.",
    price: "25.00",
    imageUrl:
      "https://utfs.io/f/8a457cda-f768-411d-a737-cdb23ca6b9b5-b3pegf.png",
  },
];

async function main() {
  console.log("Iniciando o processo de seed...");

  try {
    // 1. Limpar dados existentes para evitar duplicatas
    // A ordem é importante: primeiro os "filhos" (serviços), depois os "pais" (barbearias)
    console.log("Limpando dados antigos...");
    await prisma.barbershopService.deleteMany();
    await prisma.barbershop.deleteMany();
    console.log("Dados antigos limpos com sucesso.");

    // 2. Criar as barbearias e seus respectivos serviços
    console.log("Criando novas barbearias e serviços...");
    for (const shop of barbershopData) {
      const barbershop = await prisma.barbershop.create({
        data: {
          name: shop.name,
          address: shop.address,
          imageUrl: shop.imageUrl,
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nisl eu nisl.",
          phone: ["(11) 98765-4321", "(11) 1234-5678"], // Corrigido para "phone" (singular) como no schema
        },
      });

      for (const service of servicesData) {
        await prisma.barbershopService.create({
          data: {
            name: service.name,
            description: service.description,
            price: new Prisma.Decimal(service.price), // Usando o construtor Prisma.Decimal para maior robustez
            imageUrl: service.imageUrl,
            barbershopId: barbershop.id, // Conectando o serviço à barbearia criada
          },
        });
      }
    }
    console.log("Seed executado com sucesso!");
  } catch (error) {
    console.error("Ocorreu um erro durante o processo de seed:", error);
    process.exit(1);
  } finally {
    // 3. Desconectar o Prisma Client ao final do processo
    console.log("Desconectando o Prisma Client...");
    await prisma.$disconnect();
  }
}

// Executa a função principal
main();
