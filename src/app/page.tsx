import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  return (
    <div>
      <Header />
      <div className="p-5">
        <h2 className="text-xl font-bold">Olá, Helton</h2>
        <p>Segunda-Feira, 26 de junho</p>

        <div className="flex items-center gap-2 mt-6">
          <Input placeholder="Buscar" />
          <Button size="icon">
            <SearchIcon />
          </Button>
        </div>

        <div className="relative w-full h-[150px] mt-6">
          <Image
            src="/banner-01.png"
            fill
            alt="Banner"
            className="object-cover rounded-xl"
          />
        </div>

        <Card className="mt-6">
          <CardContent className="flex justify-between items-center p-4">
            <div className="flex flex-col gap-2">
              <Badge className="w-fit">Confirmado</Badge>
              <h3 className="font-bold text-lg">Corte de Cabelo</h3>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="https://github.com/shadcn.png" />
                </Avatar>
                <p className="text-sm text-gray-400">
                  Barbearia Navalha Afiada
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center text-white px-4 border-l-2 border-solid ">
              <p className="text-sm font-semibold">Junho</p>
              <p className="text-2xl font-bold">23</p>
              <p className="text-sm font-semibold">20:00</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
