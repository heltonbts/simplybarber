"use client";

import { Button } from "./ui/button";
import { SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

interface ContactProps {
  phone: string;
}

const Contact = ({ phone }: ContactProps) => {
  const handleCopyPhoneClick = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast("Telefone copiado para a área de transferência!", {
      duration: 2000,
    });
  };

  return (
    <div className="flex justify-between" key={phone}>
      <div className="flex items-center gap-2">
        <SmartphoneIcon />
        <p className="text-sm">{phone}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleCopyPhoneClick(phone)}
      >
        Copiar
      </Button>
    </div>
  );
};

export default Contact;
