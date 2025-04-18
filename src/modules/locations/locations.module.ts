// src/modules/locations/locations.module.ts
import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService], // Si otros módulos lo necesitan
})
export class LocationsModule {}
