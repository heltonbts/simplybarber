"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Clock,
  Users,
  Calendar,
  DollarSign,
  Settings,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Horários", href: "/dashboard/horarios", icon: Clock },
  { label: "Serviços", href: "/dashboard/servicos", icon: Scissors },
  { label: "Barbeiros", href: "/dashboard/barbeiros", icon: Users },
  { label: "Agendamentos", href: "/dashboard/agendamentos", icon: Calendar },
  { label: "Financeiro", href: "/dashboard/financeiro", icon: DollarSign },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Botão de menu visível só no mobile */}
      <div className="md:hidden p-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-0">
            <nav className="flex flex-col space-y-1 py-4 px-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-muted transition text-sm"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sidebar permanente para telas grandes */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:h-screen md:border-r md:py-6 md:px-4 md:fixed">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-muted transition text-sm",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
