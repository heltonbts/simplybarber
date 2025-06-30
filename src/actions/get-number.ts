"use server";

import { db } from "@/lib/prisma";

export async function updatePhoneIfMissing(email: string, phone: string) {
  const user = await db.user.findUnique({ where: { email } });

  if (user) {
    await db.user.update({
      where: { email },
      data: { phone },
    });
  }
}
