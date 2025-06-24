import Sidebar from "./sidebar";
import { Card, CardContent } from "./ui/card";
import Image from "next/image";

const Header = () => {
  return (
    <Card>
      <CardContent className="flex flex-row items-center justify-between pl-2 z-50">
        <Image src="/logo.png" height={18} width={120} alt="Logo" />
        <Sidebar variant="ghost" />
      </CardContent>
    </Card>
  );
};

export default Header;
