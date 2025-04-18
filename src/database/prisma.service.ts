import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to the database...');
    await this.$connect();
    this.logger.log('Prisma Client Connected');

    // Escuchar eventos de query de Prisma
    this.$on('query', (e) => {
      this.logger.debug(`Query: ${e.query}`);
      this.logger.debug(`Params: ${e.params}`);
      this.logger.debug(`Duration: ${e.duration} ms`);
    });
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      this.logger.log('Disconnecting Prisma Client...');
      await app.close();
      this.logger.log('Prisma Client Disconnected');
    });
  }

  // Método opcional para limpieza de base de datos en tests
  // async cleanDatabase() { ... }
}
