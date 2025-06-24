import Image from "next/image";
import { BarbershopService } from "../../generated/prisma";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

interface ServiceItemProps {
  service: BarbershopService;
}
const ServiceItem = ({ service }: ServiceItemProps) => {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 p-2 pt-0 pb-0">
          <div className="relative min-h-[110px] min-w-[110px] max-h-[110px] max-h-[110px]">
            <Image
              src={service.imageUrl}
              alt={service.name}
              fill
              className="rounded-md"
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{service.name}</h3>
            <p className="text-sm text-gray-400">{service.description}</p>

            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-primary">
                {Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(service.price))}
              </p>
              <Button size="sm" variant="secondary">
                Agendar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceItem;
