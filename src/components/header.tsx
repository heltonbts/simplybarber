import { MenuIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import Image from "next/image";

const Header = () => {
  return (
    <Card>
      <CardContent className="flex flex-row items-center justify-between pl-2 z-50">
        <Image src="/logo.png" height={18} width={120} alt="Logo" />
        <Button variant="outline">
          <MenuIcon />
        </Button>
      </CardContent>
    </Card>
  );
};

export default Header;
