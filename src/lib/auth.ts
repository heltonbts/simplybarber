import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (!token.email) {
        return token;
      }

      // Busca o usuário no banco de dados para obter todos os campos
      const dbUser = await db.user.findUnique({
        where: {
          email: token.email,
        },
      });

      // Se o usuário existir no banco, atualiza o token com os dados dele
      if (dbUser) {
        token.id = dbUser.id;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.picture = dbUser.image;
        token.phone = dbUser.phone; // <-- Agora o 'phone' é adicionado corretamente
      }

      return token;
    },

    // O callback 'session' agora receberá o 'phone' do token JWT
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
        session.user.phone = token.phone as string | null | undefined; // <-- Adicionado aqui
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
