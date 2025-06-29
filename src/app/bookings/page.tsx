import Header from "@/components/headers";
import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import BookingItem from "@/components/booking";
import { Decimal } from "@prisma/client/runtime/library";

const Bookings = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return notFound;
  }
  const bookings = await db.booking.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      service: {
        include: {
          barbershop: true,
        },
      },
    },
  });

  const confirmedBoking = bookings.filter(
    (booking) => booking.date >= new Date(),
  );
  const pastBoking = bookings.filter((booking) => booking.date < new Date());

  const convertBookingPrice = (booking: (typeof bookings)[0]) => ({
    ...booking,
    service: {
      ...booking.service,
      price: new Decimal(booking.service.price),
    },
  });

  return (
    <>
      <Header />
      <div className="p-5 space-y-3">
        {confirmedBoking.length === 0 && pastBoking.length === 0 && (
          <>
            <h2 className="text-xl font-semibold">
              Nenhuma reserva encontrada.
            </h2>
            <h3 className="mb-3 mt-6 text-xs font-bold text-gray-600">
              Você ainda não agendou nenhum serviço. Que tal marcar um horário?
            </h3>
          </>
        )}
        {confirmedBoking.length > 0 && (
          <div>
            <h1 className="text-xl font-bold">Agendamentos</h1>
            <h3 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
              Confirmados
            </h3>
            {confirmedBoking.map((bookings) => (
              <BookingItem
                booking={convertBookingPrice(bookings)}
                key={bookings.id}
              />
            ))}
          </div>
        )}

        {pastBoking.length > 0 && (
          <>
            <h3 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
              Finalizado
            </h3>
            {pastBoking.map((bookings) => (
              <BookingItem
                booking={convertBookingPrice(bookings)}
                key={bookings.id}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};

export default Bookings;
