import { UserRole } from "@prisma/client";

export interface JwtPayload {
  username: string;
  sub: string; // 'subject', convencionalmente el ID del usuario
  roles: UserRole[]; // Incluir roles en el payload
  // Puedes añadir más campos si los necesitas directamente del token
}
