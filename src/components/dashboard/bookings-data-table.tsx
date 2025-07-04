/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  ClockIcon,
  MoreHorizontal,
  Pencil,
  PersonStandingIcon,
  ScissorsIcon,
  Trash2,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookingDetails } from "@/actions/create-booking";

interface BookingsDataTableProps {
  data: BookingDetails[];
  onEdit: (booking: BookingDetails) => void;
  onDelete: (bookingId: string) => void;
}

export function BookingsDataTable({
  data,
  onEdit,
  onDelete,
}: BookingsDataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
                <p>Nenhum agendamento encontrado.</p>     {" "}
      </div>
    );
  }

  return (
    <>
            {/* Layout Mobile: Cards */}     {" "}
      <div className="grid gap-4 sm:hidden">
               {" "}
        {data.map((booking: any) => (
          <Card key={booking.id}>
                       {" "}
            <CardContent className="p-4 space-y-3">
                           {" "}
              <div className="flex justify-between items-start">
                               {" "}
                <Badge
                  variant={
                    new Date(booking.date) > new Date()
                      ? "default"
                      : "secondary"
                  }
                >
                                   {" "}
                  {new Date(booking.date) > new Date()
                    ? "Confirmado"
                    : "Finalizado"}
                                 {" "}
                </Badge>
                               {" "}
                <DropdownMenu>
                                   {" "}
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                                   {" "}
                  <DropdownMenuContent align="end">
                                       {" "}
                    <DropdownMenuItem onClick={() => onEdit(booking)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Editar</span>
                    </DropdownMenuItem>
                                       {" "}
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => onDelete(booking.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Excluir</span>
                    </DropdownMenuItem>
                                     {" "}
                  </DropdownMenuContent>
                                 {" "}
                </DropdownMenu>
                             {" "}
              </div>
                           {" "}
              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />               {" "}
                <span className="font-semibold">
                  {booking.clientName ||
                    booking.user?.name ||
                    "Cliente não informado"}
                </span>
                             {" "}
              </div>
                           {" "}
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(new Date(booking.date), "dd/MM/yy")}</span>
              </div>
                           {" "}
              <div className="flex items-center gap-2 text-sm">
                <ClockIcon className="h-4 w-4" />
                <span>{format(new Date(booking.date), "HH:mm")}</span>
              </div>
                           {" "}
              <div className="flex items-center gap-2 text-sm">
                <ScissorsIcon className="h-4 w-4" />
                <span>{booking.service.name}</span>
              </div>
                           {" "}
              <div className="flex items-center gap-2 text-sm">
                <PersonStandingIcon className="h-4 w-4" />
                <span>{booking.barber.user.name}</span>
              </div>
                         {" "}
            </CardContent>
                     {" "}
          </Card>
        ))}
             {" "}
      </div>
           {" "}
      {/* Layout Desktop: Tabela (JSX sem espaços para evitar erro de hidratação) */}
           {" "}
      <div className="hidden sm:block border rounded-md">
               {" "}
        <Table>
                   {" "}
          <TableHeader>
                       {" "}
            <TableRow>
                            <TableHead>Status</TableHead>             {" "}
              <TableHead>Cliente</TableHead>             {" "}
              <TableHead>Data e Hora</TableHead>             {" "}
              <TableHead>Serviço</TableHead>             {" "}
              <TableHead>Barbeiro</TableHead>             {" "}
              <TableHead className="text-right">Ações</TableHead>         
               {" "}
            </TableRow>
                     {" "}
          </TableHeader>
                   {" "}
          <TableBody>
                       {" "}
            {data.map((booking: any) => (
              <TableRow key={booking.id}>
                               {" "}
                <TableCell>
                  <Badge
                    variant={
                      new Date(booking.date) > new Date()
                        ? "default"
                        : "secondary"
                    }
                  >
                    {new Date(booking.date) > new Date()
                      ? "Confirmado"
                      : "Finalizado"}
                  </Badge>
                </TableCell>
                               {" "}
                <TableCell>
                  {booking.clientName ||
                    booking.user?.name ||
                    "Cliente não informado"}
                </TableCell>
                               {" "}
                <TableCell>
                  {format(new Date(booking.date), "dd/MM/yy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                                <TableCell>{booking.service.name}</TableCell>   
                            <TableCell>{booking.barber.user.name}</TableCell>   
                           {" "}
                <TableCell className="text-right">
                                   {" "}
                  <DropdownMenu>
                                       {" "}
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                                       {" "}
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(booking)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Editar</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete(booking.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Excluir</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                                     {" "}
                  </DropdownMenu>
                                 {" "}
                </TableCell>
                             {" "}
              </TableRow>
            ))}
                     {" "}
          </TableBody>
                 {" "}
        </Table>
             {" "}
      </div>
         {" "}
    </>
  );
}
