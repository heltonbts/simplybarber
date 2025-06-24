import { Avatar, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

const Booking = () => {
  return (
    <>
      <h2 className="mb-3 mt-6 text-xs font-bold uppercase text-gray-400">
        agendamentos
      </h2>

      <Card>
        <CardContent className="flex justify-between items-center p-4">
          <div className="flex flex-col gap-2">
            <Badge className="w-fit">Confirmado</Badge>
            <h3 className="font-bold text-lg">Corte de Cabelo</h3>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src="https://github.com/shadcn.png" />
              </Avatar>
              <p className="text-sm text-gray-400">Barbearia Navalha Afiada</p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-white px-4 border-l-2 border-solid ">
            <p className="text-sm font-semibold">Junho</p>
            <p className="text-2xl font-bold">23</p>
            <p className="text-sm font-semibold">20:00</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default Booking;
