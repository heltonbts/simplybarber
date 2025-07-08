import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { authOptions } from "@/lib/auth"; // Ajuste o caminho se necessário
import { db } from "@/lib/prisma";

// Importando componentes do shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Sidebar } from "@/components/dashboard/sidebar";
import { UserIcon } from "lucide-react";

const DashboardPage = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const [barbershop, dayBookings] = await Promise.all([
    db.barbershop.findFirst({
      where: {
        ownerId: (session.user as { id: string }).id,
      },
    }),
    db.booking.findMany({
      where: {
        barbershop: {
          ownerId: (session.user as { id: string }).id,
        },
        date: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
      include: {
        service: true,
        user: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
  ]);

  if (!barbershop) {
    redirect("/");
  }

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <header className="flex justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Visão Geral</h2>
          <p className="text-gray-400 capitalize">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Sidebar />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#141416] border-gray-800 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Faturamento (Dia)
            </CardTitle>
            <i className="ph-bold ph-currency-dollar text-2xl text-green-400"></i>
          </CardHeader>
        </Card>
        <Card className="bg-[#141416] border-gray-800 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Agendamentos (Hoje)
            </CardTitle>
            <i className="ph-bold ph-calendar-check text-2xl text-purple-400"></i>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dayBookings.length}</p>
            <p className="text-xs text-gray-500">Total de clientes para hoje</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Próximos Clientes</h3>
        <Card className="bg-[#141416] border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Cliente</TableHead>
                <TableHead className="text-gray-400">Horário</TableHead>
                <TableHead className="text-gray-400">Serviço</TableHead>
                <TableHead className="text-right text-gray-400">
                  Valor
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayBookings.length > 0 ? (
                dayBookings.map((booking) => (
                  <TableRow key={booking.id} className="border-gray-800">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={booking.user?.image || undefined}
                            alt={
                              booking.user?.name ||
                              booking.clientName ||
                              "Cliente"
                            }
                          />
                          <AvatarFallback>
                            {booking.user?.name ? (
                              booking.user.name.charAt(0).toUpperCase()
                            ) : booking.clientName ? (
                              booking.clientName.charAt(0).toUpperCase()
                            ) : (
                              <UserIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-white">
                            {booking.user?.name ||
                              booking.clientName ||
                              "Cliente (manual)"}
                          </p>
                          {/* ... (resto do conteúdo do agendamento) */}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{format(booking.date, "HH:mm")}</TableCell>
                    <TableCell>{booking.service.name}</TableCell>
                    <TableCell className="text-right">
                      R${" "}
                      {Number(booking.service.price)
                        .toFixed(2)
                        .replace(".", ",")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-gray-500 py-10"
                  >
                    Nenhum agendamento para hoje.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
