import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto'; // Crearemos este DTO

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  // Usa 'local' como nombre por defecto
  constructor(private authService: AuthService) {
    super({
      usernameField: 'username', // Campo esperado en el body para el username
      // passwordField: 'password' // Es el default, no necesita especificarse
    });
  }

  // Passport llama automáticamente a este método con las credenciales del body
  async validate(username: string, pass: string): Promise<any> {
    console.log(`LocalStrategy: Validating user ${username}`); // Log para depuración
    const user = await this.authService.validateUser(username, pass);
    if (!user) {
      console.log(`LocalStrategy: Validation failed for user ${username}`); // Log para depuración
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log(`LocalStrategy: Validation successful for user ${username}`); // Log para depuración
    // Lo que retorna validate se adjunta a req.user en las rutas protegidas por LocalAuthGuard
    return user;
  }
}
