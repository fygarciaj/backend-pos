import { NestFactory, Reflector } from '@nestjs/core'; // Importar Reflector
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './database/prisma.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
//import { RolesGuard } from './modules/auth/guards/roles.guard';
// Importar el guard

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const reflector = app.get(Reflector); // Obtener instancia de Reflector

  // Configuración global de prefijo, CORS, validación... (como ya tenías)
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'), // Configurable
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades no esperadas
      transform: true, // Transforma payload a instancias de DTO
      transformOptions: {
        enableImplicitConversion: true, // Permite conversión implícita de tipos (ej: string de query a number)
      },
    }),
  );

  // --- Aplicar JwtAuthGuard Globalmente ---
  // Reflector es necesario para que el guard pueda leer la metadata de @Public()
  app.useGlobalGuards(new JwtAuthGuard(reflector)); // Aplicar el guard globalmente
  // --- Fin de Aplicar JwtAuthGuard Globalmente ---

  // Swagger (como ya tenías)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS Backend API')
    .setDescription('API documentation for the Point of Sale backend')
    .setVersion('1.0')
    .addBearerAuth() // Para JWT
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  // Prisma Shutdown Hook (como ya tenías)
  await prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`🚀 Application listening on port ${port}`);
  logger.log(`🚀 API Prefix set to /${apiPrefix}`);
  logger.log(`🚀 Swagger UI available at /${apiPrefix}/docs`);
}
bootstrap();
