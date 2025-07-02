/*
  Warnings:

  - A unique constraint covering the columns `[barbershopId,weekDay]` on the table `BarbershopWorkingHour` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BarbershopWorkingHour_barbershopId_weekDay_key" ON "BarbershopWorkingHour"("barbershopId", "weekDay");
