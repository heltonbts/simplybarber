"use client";

import { signIn, useSession, signOut } from "next-auth/react";

import {
  Calendar1Icon,
  HomeIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
} from "lucide-react";
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
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage } from "./ui/avatar";

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
  const { data } = useSession();

  const loginWithGoogle = async () => {
    await signIn("google");
  };
  const HandleSignOut = async () => {
    await signOut();
  };

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

        {data?.user ? (
          <div className="p-5 pt-0 border-b border-solid flex items-center gap-2 justify-start">
            <Avatar>
              <AvatarImage
                width={18}
                height={18}
                src={data?.user?.image}
                alt={data?.user?.name || "User"}
              />
            </Avatar>
            <div>
              <h3 className="text-sm font-bold">
                {data?.user?.name || "Usuário"}
              </h3>
              <p className="text-xs text-gray-400">{data?.user.email}</p>
            </div>
          </div>
        ) : (
          <div className="p-5 pt-0 border-b border-solid flex items-center gap-2 justify-between">
            <h2 className="font-bold">Olá, Faça seu Login!</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon">
                  <LogInIcon size="icon" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90%]">
                <DialogHeader>
                  <DialogTitle>Faça o seu login</DialogTitle>
                  <DialogDescription>
                    Conecte-se usando sua conta do Google.
                  </DialogDescription>
                  <Button onClick={loginWithGoogle} variant="outline">
                    <Image
                      alt="Faça o seu login com google"
                      src="/google.svg"
                      width={18}
                      height={18}
                    />{" "}
                    <p className="font-bold text-white">Google</p>
                  </Button>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
        )}

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
          <Button
            variant="ghost"
            className="justify-start"
            size="sm"
            onClick={HandleSignOut}
          >
            <LogOutIcon />
            Sair da conta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Sidebar;
