import { NestFactory, Reflector } from '@nestjs/core'; // Importar Reflector: Import the NestFactory and Reflector classes from the @nestjs/core package. Reflector is used for metadata reflection.
import { AppModule } from './app.module'; // Import the AppModule which is the root module of the application.
import { Logger, ValidationPipe } from '@nestjs/common'; // Import Logger and ValidationPipe from @nestjs/common. Logger is used for logging, and ValidationPipe for request validation.
import { ConfigService } from '@nestjs/config'; // Import ConfigService from @nestjs/config. It's used to access configuration variables.
import { PrismaService } from './database/prisma.service'; // Import PrismaService, which is a service for interacting with the Prisma database.
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // Import DocumentBuilder and SwaggerModule from @nestjs/swagger for generating and serving Swagger documentation.
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'; // Import JwtAuthGuard, a guard for JWT authentication.
//import { RolesGuard } from './modules/auth/guards/roles.guard';
// Importar el guard

async function bootstrap() {
  const app = await NestFactory.create(AppModule); // Create a NestJS application instance.
  const logger = new Logger('Bootstrap'); // Create a logger instance for the bootstrap process.
  const configService = app.get(ConfigService); // Get the ConfigService instance from the application.
  const prismaService = app.get(PrismaService); // Get the PrismaService instance from the application.
  const reflector = app.get(Reflector); // Obtener instancia de Reflector: Get the Reflector instance from the application.

  // Configuración global de prefijo, CORS, validación... (como ya tenías)
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1'); // Get the API prefix from the configuration, defaulting to 'api/v1'.
  app.setGlobalPrefix(apiPrefix); // Set the global API prefix for the application.

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'), // Configurable: Get the CORS origin from the configuration, defaulting to '*'.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Define allowed HTTP methods.
    credentials: true, // Enable sending credentials in CORS requests.
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades no definidas en el DTO: Remove properties that are not defined in the DTO.
      forbidNonWhitelisted: true, // Lanza error si hay propiedades no esperadas: Throw an error if there are unexpected properties.
      transform: true, // Transforma payload a instancias de DTO: Transform the payload to DTO instances.
      transformOptions: {
        enableImplicitConversion: true, // Permite conversión implícita de tipos (ej: string de query a number): Enable implicit type conversion (e.g., string from query to number).
      },
    }),
  );

  // --- Aplicar JwtAuthGuard Globalmente ---
  // Reflector es necesario para que el guard pueda leer la metadata de @Public()
  app.useGlobalGuards(new JwtAuthGuard(reflector)); // Aplicar el guard globalmente: Apply the JwtAuthGuard globally. Reflector is needed to read the metadata of @Public().
  // --- Fin de Aplicar JwtAuthGuard Globalmente ---

  // Swagger (como ya tenías)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('POS Backend API')
    .setDescription('API documentation for the Point of Sale backend')
    .setVersion('1.0')
    .addBearerAuth()
    .addBasicAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  // Prisma Shutdown Hook (como ya tenías)
  prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('PORT', 3000); // Get the port from the configuration, defaulting to 3000.
  await app.listen(port); // Start the application and listen on the specified port.
  logger.log(`🚀 Application listening on port ${port}`); // Log that the application is listening on the specified port.
  logger.log(`🚀 API Prefix set to /${apiPrefix}`); // Log the API prefix.
  logger.log(`🚀 Swagger UI available at /${apiPrefix}/docs`); // Log the Swagger UI URL.
}

void bootstrap(); // Call the bootstrap function to start the application.
