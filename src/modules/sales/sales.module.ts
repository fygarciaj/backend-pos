// src/modules/sales/sales.module.ts
import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { ProductsModule } from '../products/products.module'; // <-- Importar ProductsModule

@Module({
  imports: [ProductsModule], // <-- Añadir aquí para poder inyectar ProductsService
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService], // Exportar si otros módulos lo necesitan (ej: Devoluciones)
})
export class SalesModule {}
