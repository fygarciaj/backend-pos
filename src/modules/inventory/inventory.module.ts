// src/modules/inventory/inventory.module.ts
import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsModule } from '../products/products.module'; // <-- Importar ProductsModule

@Module({
  imports: [ProductsModule], // <-- Añadir aquí
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService], // Si otros módulos lo necesitan
})
export class InventoryModule {}
