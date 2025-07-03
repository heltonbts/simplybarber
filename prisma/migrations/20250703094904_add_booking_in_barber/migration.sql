/*
  Warnings:

  - A unique constraint covering the columns `[barberId,date]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BarbershopService" ALTER COLUMN "durationInMinutes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "barberId" TEXT NOT NULL DEFAULT 'bc4018bf-3c21-4b39-8653-869f5a53133f',
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "clientPhone" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_barberId_date_key" ON "Booking"("barberId", "date");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
