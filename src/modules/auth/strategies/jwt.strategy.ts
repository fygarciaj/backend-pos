import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service'; // Necesitamos buscar el usuario
import { JwtPayload } from '../interfaces/jwt-payload.interface'; // Crearemos esta interfaz

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Usa 'jwt' como nombre por defecto
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService, // Inyectar UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrae el token del header 'Authorization: Bearer <token>'
      ignoreExpiration: false, // Asegura que los tokens expirados sean rechazados
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'), // Usa la misma clave secreta
    });
  }

  // Passport llama a este método después de verificar la firma del JWT y que no haya expirado
  async validate(payload: JwtPayload): Promise<any> {
    console.log('JwtStrategy: Validating payload:', payload); // Log para depuración
    // El payload es el objeto que pusimos al firmar el token en auth.service.ts (login)
    // Podemos usar el 'sub' (userId) para buscar el usuario completo en la DB si es necesario
    // o simplemente confiar en el payload si contiene toda la info necesaria (ej: roles)

    // Opcional: Buscar el usuario en la DB para asegurarse de que todavía existe y está activo
    const user = await this.usersService.findOne(payload.sub); // findOne ya excluye la contraseña
    if (!user || !user.isActive) {
      console.log(`JwtStrategy: User ${payload.sub} not found or inactive.`); // Log para depuración
      throw new UnauthorizedException('User not found or inactive');
    }

    console.log(
      `JwtStrategy: Validation successful for user ${user.username} (ID: ${user.id})`,
    ); // Log para depuración
    // Lo que retorna validate se adjunta a req.user en las rutas protegidas por JwtAuthGuard
    // Devolvemos el payload o el objeto de usuario encontrado (sin contraseña)
    // Es común devolver un objeto que contenga al menos el ID y el rol
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
    // O devolver el objeto 'user' completo (sin contraseña) si se necesita más info en los controladores:
    // return user;
  }
}
