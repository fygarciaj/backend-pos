import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponse } from './interfaces/login-response.interface';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Valida si un usuario existe y la contraseña es correcta.
   * Usado por LocalStrategy.
   * @param username - El nombre de usuario.
   * @param pass - La contraseña en texto plano.
   * @returns El objeto de usuario (sin contraseña) si es válido, null en caso contrario.
   */
  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    this.logger.debug(`Attempting to validate user: ${username}`);
    const user = await this.usersService.findByUsername(username); // Busca usuario por username

    if (!user) {
      this.logger.warn(`User not found: ${username}`);
      return null; // Usuario no encontrado
    }

    if (!user.isActive) {
      this.logger.warn(`User is inactive: ${username}`);
      throw new UnauthorizedException(`User ${username} is inactive.`); // Lanzar excepción si está inactivo
    }

    const isPasswordMatching = await bcrypt.compare(pass, user.password); // Compara hash

    if (user && isPasswordMatching) {
      this.logger.log(`User validation successful: ${username}`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user; // Excluir contraseña del objeto retornado
      return result;
    }

    this.logger.warn(`Invalid password for user: ${username}`);
    return null; // Contraseña incorrecta
  }

  /**
   * Genera un token JWT para un usuario autenticado.
   * Usado por AuthController después de que LocalStrategy valida.
   * @param user - El objeto de usuario validado (sin contraseña).
   * @returns Un objeto con el access_token.
   */
  async login(user: Omit<User, 'password'>): Promise<LoginResponse> {
    this.logger.log(
      `Generating JWT for user: ${user.username} (ID: ${user.id})`,
    );
    const payload: JwtPayload = {
      username: user.username,
      sub: user.id,
      roles: [user.role], // Asumiendo que el rol está directamente en el objeto User
      // Si tuvieras una relación muchos-a-muchos para roles, necesitarías cargarlos aquí
    };
    const accessToken = this.jwtService.sign(payload);

    // Opcional: Actualizar lastLogin del usuario
    try {
      await this.usersService.update(user.id, { lastLogin: new Date() });
    } catch (error) {
      this.logger.error(
        `Failed to update lastLogin for user ${user.id}`,
        error.stack,
      );
      // No fallar el login si esto falla, pero sí loguearlo.
    }

    return {
      access_token: accessToken,
    };
  }

  // Podrías añadir una función de 'verify' si necesitas validar un token manualmente en algún servicio
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return payload;
    } catch (error) {
      this.logger.error('Invalid token verification', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
