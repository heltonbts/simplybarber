import { Button } from "./ui/button";
import Image from "next/image";

const QuickSearch = () => {
  interface QuickSearchOption {
    imageUrl: string;
    title: string;
  }
  const quickSeachOptions: QuickSearchOption[] = [
    {
      imageUrl: "/cabelo.svg",
      title: "Cabelo",
    },
    {
      imageUrl: "/barba.svg",
      title: "Barba",
    },
    {
      imageUrl: "/acabamento.svg",
      title: "Acabamento",
    },
    {
      imageUrl: "/hidratacao.svg",
      title: "Hidratação",
    },
    {
      imageUrl: "/sobrancelha.svg",
      title: "Sobrancelha",
    },
  ];

  return (
    <div className="flex gap-3 mt-6 overflow-x-scroll [&::-webkit-scrollbar]:hidden">
      {quickSeachOptions.map((option) => (
        <Button className="gap-2" variant="secondary" key={option.title}>
          <Image
            src={option.imageUrl}
            alt={option.title}
            width={16}
            height={16}
          />
          {option.title}
        </Button>
      ))}
    </div>
  );
};

export default QuickSearch;
