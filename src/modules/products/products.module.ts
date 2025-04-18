import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
// PrismaModule es global, no necesita re-importarse aquí si se configuró en AppModule
// import { PrismaModule } from '../database/prisma.module';

@Module({
  // imports: [PrismaModule], // No es necesario si PrismaModule es global
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService] // Exportar el servicio si otros módulos lo necesitan (ej: SalesModule)
})
export class ProductsModule {}
