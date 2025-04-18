import { PartialType } from '@nestjs/swagger';
import { CreateSaleDto } from './create-sale.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SaleStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

// No permitir actualizar items o montos una vez creada (generalmente)
// Solo estado, notas, etc.
export class UpdateSaleDto {
  @ApiPropertyOptional({
    description: 'New status for the sale',
    enum: SaleStatus,
  })
  @IsEnum(SaleStatus)
  @IsOptional()
  status?: SaleStatus;

  @ApiPropertyOptional({ description: 'Updated notes or comments' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Updated receipt or invoice number' })
  @IsString()
  @IsOptional()
  receiptNumber?: string;

  // Añadir otros campos actualizables si es necesario
}
