import Header from "@/components/header";
import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { notFound } from "next/navigation";
import BookingItem from "@/components/booking";

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

  return (
    <>
      <Header />
      <div className="p-5 space-y-3">
        <h1 className="text-xl font-bold">Agendamentos</h1>
        <h3 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
          Confirmados
        </h3>
        {confirmedBoking.map((bookings) => (
          <BookingItem booking={bookings} key={bookings.id} />
        ))}
        <h3 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-600">
          Finalizados
        </h3>
        {pastBoking.map((bookings) => (
          <BookingItem booking={bookings} key={bookings.id} />
        ))}
      </div>
    </>
  );
};

export default Bookings;
