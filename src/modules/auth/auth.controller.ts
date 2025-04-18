import { Controller, Post, UseGuards, Request, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard'; // Crearemos este guard
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiBody, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginResponse } from './interfaces/login-response.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // Crearemos este guard
import { Public } from './decorators/public.decorator'; // Crearemos este decorador

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // --- Login Endpoint ---
  @Public() // Marcar esta ruta como pública (no requiere JWT)
  @UseGuards(LocalAuthGuard) // Aplicar el guard de autenticación local
  @Post('login')
  @HttpCode(HttpStatus.OK) // Responder con 200 OK en lugar de 201 Created
  @ApiOperation({ summary: 'Log in a user' })
  @ApiBody({ type: LoginDto }) // Documentar el cuerpo esperado
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT token.', type: Object }) // Ajustar el tipo de respuesta si es necesario
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid credentials.' })
  async login(@Request() req, @Body() loginDto: LoginDto): Promise<LoginResponse> {
    // Si LocalAuthGuard pasa, significa que req.user contiene el usuario validado por LocalStrategy
    // loginDto solo se usa aquí para la documentación de Swagger y validación de entrada
    return this.authService.login(req.user);
  }

  // --- Profile Endpoint (Ejemplo de ruta protegida) ---
  @UseGuards(JwtAuthGuard) // Proteger esta ruta con el guard JWT
  @Get('profile')
  @ApiBearerAuth() // Indicar en Swagger que requiere token Bearer
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns the authenticated user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Token missing or invalid.' })
  getProfile(@Request() req) {
    // JwtAuthGuard (a través de JwtStrategy) adjunta el payload validado (o el usuario) a req.user
    return req.user; // Devuelve la información del usuario adjuntada por JwtStrategy
  }

   // --- Refresh Token Endpoint (Opcional - Implementación más avanzada) ---
   // @Post('refresh')
   // async refreshToken(@Body('refreshToken') refreshToken: string) {
   //   // Lógica para validar el refresh token y emitir un nuevo access token
   // }
}
