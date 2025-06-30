import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompleteRegisterForm } from "@/components/complete-register-form";

export default async function CompletarPerfilPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  if (session.user.phone) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <CompleteRegisterForm email={session.user.email} />
    </div>
  );
}
