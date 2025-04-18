import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';
import { CreatePurchaseOrderItemDto } from './create-purchase-order-item.dto';

export class CreatePurchaseOrderDto {
  @ApiProperty({
    description: 'UUID of the supplier for this order',
    example: 'uuid-supplier-1',
  })
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  // createdByUserId se obtendrá del usuario autenticado

  @ApiPropertyOptional({
    description: 'Date the order was placed',
    example: new Date().toISOString(),
  })
  @IsDateString()
  @IsOptional() // Podría tomarse la fecha actual por defecto en el servicio
  orderDate?: string = new Date().toISOString();

  @ApiPropertyOptional({
    description: 'Expected delivery date',
    example: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional({
    description: 'Status of the purchase order',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.PENDING,
  })
  @IsEnum(PurchaseOrderStatus)
  @IsOptional()
  status?: PurchaseOrderStatus = PurchaseOrderStatus.PENDING;

  @ApiPropertyOptional({
    description: 'Notes or comments about the purchase order',
    example: 'Urgente para reponer stock.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'List of items included in the purchase order',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];

  // totalAmount se calculará en el servicio.
  // receivedDate se establecerá al recibir.
}
