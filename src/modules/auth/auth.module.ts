import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // Importa UsersModule
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Para leer config
import { LocalStrategy } from './strategies/local.strategy'; // Crearemos esto
import { JwtStrategy } from './strategies/jwt.strategy'; // Crearemos esto

@Module({
  imports: [
    UsersModule, // Necesitamos UsersService para validar usuarios
    PassportModule.register({ defaultStrategy: 'jwt' }), // Registrar Passport, JWT como default
    JwtModule.registerAsync({
      imports: [ConfigModule], // Importar ConfigModule para usar ConfigService
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'), // Leer secreto desde .env
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION_TIME', '60m'), // Leer tiempo de expiración o usar default
        },
      }),
      inject: [ConfigService], // Inyectar ConfigService en useFactory
    }),
    ConfigModule, // Asegurarse de que ConfigModule esté disponible (ya es global)
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy, // Registrar la estrategia local
    JwtStrategy,   // Registrar la estrategia JWT
  ],
  exports: [AuthService, JwtModule], // Exportar JwtModule si otros módulos necesitan verificar/decodificar tokens
})
export class AuthModule {}
