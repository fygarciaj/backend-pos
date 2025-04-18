import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ReturnsModule } from './returns/returns.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ReportsModule } from './reports/reports.module';
import { LocationsModule } from './locations/locations.module';
// import { AuditModule } from './audit/audit.module'; // Descomentar si se implementa
import { ProductsModule } from './modules/products/products.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { SalesModule } from './modules/sales/sales.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule, // PrismaModule es global, no necesita re-importarse
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    SalesModule,
    ReturnsModule,
    CustomersModule,
    SuppliersModule,
    InventoryModule,
    PurchaseOrdersModule,
    ReportsModule,
    LocationsModule,
    BrandsModule,
    // AuditModule, // Descomentar si se implementa
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
