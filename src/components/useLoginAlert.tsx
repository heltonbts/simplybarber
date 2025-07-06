"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { Chrome, User } from "lucide-react";
import { useState } from "react";

interface LoginAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actionText?: string;
}

export function LoginAlertDialog({
  isOpen,
  onClose,
  title = "Login Necessário",
  description = "Você precisa fazer login para realizar esta ação.",
  actionText = "Fazer Login",
}: LoginAlertDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: window.location.href });
    } catch (error) {
      console.error("Erro no login:", error);
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                Carregando...
              </>
            ) : (
              <>
                <Chrome className="mr-2 h-4 w-4" />
                {actionText} com Google
              </>
            )}
          </Button>

          <AlertDialogCancel
            onClick={onClose}
            className="w-full"
            disabled={isLoading}
          >
            Cancelar
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook personalizado para usar o LoginAlertDialog
export function useLoginAlert() {
  const [isOpen, setIsOpen] = useState(false);

  const showLoginAlert = () => setIsOpen(true);
  const hideLoginAlert = () => setIsOpen(false);

  return {
    isOpen,
    showLoginAlert,
    hideLoginAlert,
    LoginAlertDialog: (
      props: Omit<LoginAlertDialogProps, "isOpen" | "onClose">,
    ) => (
      <LoginAlertDialog {...props} isOpen={isOpen} onClose={hideLoginAlert} />
    ),
  };
}
