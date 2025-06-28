"use client";

import { useSession } from "next-auth/react";

const UserNameAndData = () => {
  const now = new Date();
  const { data } = useSession();

  return (
    <>
      {" "}
      {data?.user ? (
        <h2 className="text-xl font-bold">Olá, {data?.user?.name}</h2>
      ) : (
        <h2 className="text-xl font-bold">Olá, Bem-vindo!</h2>
      )}
      <p className="capitalize">
        {now.toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
    </>
  );
};

export default UserNameAndData;
