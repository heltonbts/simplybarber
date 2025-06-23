import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div>
      <Header />
      <div className="p-5">
        <h2 className="text-xl font-bold ">Olá, Helton</h2>
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
      </div>
    </div>
  );
}
