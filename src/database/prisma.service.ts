import {
  Injectable,
  OnModuleInit,
  INestApplication,
  Logger,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' } as Prisma.LogDefinition,
        { emit: 'stdout', level: 'info' } as Prisma.LogDefinition,
        { emit: 'stdout', level: 'warn' } as Prisma.LogDefinition,
        { emit: 'stdout', level: 'error' } as Prisma.LogDefinition,
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to the database...');
    await this.$connect();
    this.logger.log('Prisma Client Connected');

    // Escuchar eventos de query de Prisma
    // this.$on('query', (e: Prisma.QueryEvent) => {
    //   this.logger.debug(`Query: ${e.query}`);
    //   this.logger.debug(`Params: ${e.params}`);
    //   this.logger.debug(`Duration: ${e.duration} ms`);
    // });
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      (async () => {
        this.logger.warn('Disconnecting Prisma Client...');
        await app.close();
        this.logger.log('Prisma Client Disconnected');
      })();
    });
  }

  // Método opcional para limpieza de base de datos en tests
  // async cleanDatabase() { ... }
}
