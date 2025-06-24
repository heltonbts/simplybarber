import { Calendar1Icon, HomeIcon, LogOutIcon, MenuIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { quickSeachOptions } from "./constants/seach";
import Image from "next/image";
import { Avatar, AvatarImage } from "./ui/avatar";
import Link from "next/link";

interface SidebarProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

const Sidebar = ({ variant }: SidebarProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={variant}>
          <MenuIcon size="icon" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <div className="p-5 pt-0 border-b border-solid flex items-center gap-2">
          <Avatar>
            <AvatarImage src="/avatar.png" />
          </Avatar>
          <div>
            <h3 className="text-sm font-bold">Helton Batista</h3>
            <p className="text-xs text-gray-400">heltonbts@icloud.com</p>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3 border-b border-solid">
          <SheetClose asChild>
            <Button asChild className="text-white-800 justify-start">
              <Link href="/">
                <HomeIcon size={18} />
                Ínicio
              </Link>
            </Button>
          </SheetClose>
          <Button className="text-white-800 justify-start" variant="ghost">
            <Calendar1Icon size={18} /> Agendamentos
          </Button>
        </div>

        <div className="p-5 flex flex-col gap-3 border-b border-solid">
          {quickSeachOptions.map((option) => (
            <Button
              key={option.title}
              className="text-white-800 justify-start"
              variant="ghost"
            >
              <Image
                src={option.imageUrl}
                height={18}
                width={18}
                alt={option.title}
              />
              {option.title}
            </Button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-2">
          <Button variant="ghost" className="justify-start" size={18}>
            <LogOutIcon />
            Sair da conta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Sidebar;
