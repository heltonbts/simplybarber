"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import {
  deleteBooking,
  BookingDetails,
  BarberWithUser,
} from "@/actions/create-booking";
import { BookingsDataTable } from "./bookings-data-table";
import { ManualBookingForm } from "./manual-booking-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar"; // shadcn calendar
import { BarbershopService } from "../../../generated/prisma";

interface BookingManagementClientProps {
  barbershopId: string;
  initialBookings: BookingDetails[];
  barbers: BarberWithUser[];
  services: BarbershopService[];
}

export function BookingManagementClient({
  barbershopId,
  initialBookings,
  barbers,
  services,
}: BookingManagementClientProps) {
  const [selectedBooking, setSelectedBooking] = useState<BookingDetails | null>(
    null,
  );
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleOpenSheet = (booking: BookingDetails | null = null) => {
    setSelectedBooking(booking);
    setIsSheetOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBooking(bookingToDelete);
      toast.success("Agendamento excluído com sucesso!");
      setBookingToDelete(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Falha ao excluir.";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBookings = initialBookings.filter((booking) =>
    isSameDay(new Date(booking.date), selectedDate),
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Gerenciar Agendamentos</CardTitle>
            <CardDescription>
              Crie, edite e exclua os agendamentos.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenSheet()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Calendário de filtro */}
            <div className="lg:w-64">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
              />
            </div>

            {/* Tabela de agendamentos filtrada */}
            <div className="flex-1">
              <div className="mb-2 font-semibold">
                Agendamentos em {format(selectedDate, "dd/MM/yyyy")}
              </div>

              <BookingsDataTable
                data={filteredBookings}
                onEdit={handleOpenSheet}
                onDelete={(id) => setBookingToDelete(id)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet para editar ou criar */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedBooking ? "Editar Agendamento" : "Novo Agendamento"}
            </SheetTitle>
          </SheetHeader>
          <div className="py-4">
            <ManualBookingForm
              key={selectedBooking?.id ?? "new"}
              barbershopId={barbershopId}
              barbers={barbers}
              services={services}
              initialData={selectedBooking}
              onFinished={() => setIsSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmação */}
      <Dialog
        open={!!bookingToDelete}
        onOpenChange={() => setBookingToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBookingToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
