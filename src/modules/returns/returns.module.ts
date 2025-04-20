import { Module } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { ProductsModule } from '../products/products.module'; // Import ProductsModule

@Module({
  imports: [ProductsModule], // Import ProductsModule
  providers: [ReturnsService],
  controllers: [ReturnsController],
})
export class ReturnsModule {}
