import { StarIcon } from "lucide-react";
import { Barbershop } from "../../generated/prisma";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import Image from "next/image";
import Link from "next/link";

interface BarbershopItemProps {
  barbershop: Barbershop;
}

const BarbershopItem = ({ barbershop }: BarbershopItemProps) => {
  return (
    <Card className="min-w-[167px] p-0 rounded-2xl">
      <CardContent className="p-0">
        <div className="relative h-[159px] w-full">
          <Image
            fill
            className="object-cover rounded-2xl"
            src={barbershop.imageUrl}
            alt={barbershop.name}
          />

          <Badge className="absolute top-2 right-2" variant="secondary">
            <StarIcon size={12} className="fill-primary text-primary" />
          </Badge>
        </div>
        <div className="px-2 py-3">
          <h3 className="font-semibold truncate">{barbershop.name}</h3>
          <p className="text-sm text-gray-400 truncate">{barbershop.address}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full rounded-2xl"
            asChild
          >
            <Link href={`/barbershops/${barbershop.id}`}>Reservar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarbershopItem;
