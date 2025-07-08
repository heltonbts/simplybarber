/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { format } from "date-fns";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BookingDetails } from "@/actions/create-booking";
import { toBrazilTime } from "@/lib/timezone-utils";

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
            {/* Layout Mobile: Cards */}     
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {data.map((booking: any) => (
          <Card key={booking.id} className="p-0 max-w-[200px] w-full">
            <CardContent className="p-2 space-y-1 text-xs">
              <div className="flex justify-between items-start">
                <Badge
                  className="text-[10px] px-2 py-0.5"
                  variant={
                    toBrazilTime(new Date(booking.date)) > new Date()
                      ? "default"
                      : "secondary"
                  }
                >
                  {toBrazilTime(new Date(booking.date)) > new Date()
                    ? "Confirmado"
                    : "Finalizado"}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(booking)}>
                      <Pencil className="mr-1 h-3 w-3" />
                      <span>Editar</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => onDelete(booking.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      <span>Excluir</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1">
                <UserIcon className="h-3 w-3" />
                <span>
                  {booking.clientName || booking.user?.name || "Cliente"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                <span>
                  {format(toBrazilTime(new Date(booking.date)), "dd/MM/yy")}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                <span>
                  {format(toBrazilTime(new Date(booking.date)), "HH:mm")}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <ScissorsIcon className="h-3 w-3" />
                <span>{booking.service.name}</span>
              </div>

              <div className="flex items-center gap-1">
                <PersonStandingIcon className="h-3 w-3" />
                <span>{booking.barber.user.name}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
