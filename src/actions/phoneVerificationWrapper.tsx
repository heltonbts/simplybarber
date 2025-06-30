"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface PhoneVerificationWrapperProps {
  children?: React.ReactNode;
}

export function PhoneVerificationWrapper({
  children,
}: PhoneVerificationWrapperProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (redirected.current) return;

    const pathname = window.location.pathname;

    const shouldRedirect =
      session?.user && !session.user.phone && pathname !== "/complete-register";

    if (shouldRedirect) {
      redirected.current = true;
      router.push("/complete-register");
    }
  }, [status, session, router]);

  return <>{children}</>;
}
