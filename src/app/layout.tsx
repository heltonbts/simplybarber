import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Alterado para Inter do Google Fonts
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Card, CardContent } from "@/components/ui/card";
import AuthProvider from "./providers/auth";
import { PhoneVerificationWrapper } from "@/actions/phoneVerificationWrapper";

// Configurando a fonte Inter
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans", // Usando uma variável CSS para a fonte
});

export const metadata: Metadata = {
  title: "Simply Barber",
  description: "Sua plataforma de agendamento para barbearias.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className="dark">
      {/* Aplicando a variável da fonte no corpo do documento */}
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <PhoneVerificationWrapper>
            <>
              <div className="flex min-h-screen flex-col">
                <main className="flex-1">{children}</main>
                <footer className="mt-auto bg-secondary">
                  <Card className="rounded-none border-x-0 border-b-0">
                    <CardContent className="py-4 text-center">
                      <p className="text-sm text-gray-400">
                        © {new Date().getFullYear()} Simply Barber. Todos os
                        direitos reservados.
                      </p>
                    </CardContent>
                  </Card>
                </footer>
              </div>
              <Toaster richColors position="top-center" />
            </>
          </PhoneVerificationWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
