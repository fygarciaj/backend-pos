import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';

// DTO para actualizar la cantidad recibida de un ítem específico
export class ReceivePurchaseOrderItemDto {
  @ApiPropertyOptional({
    description:
      'UUID of the PurchaseOrderItem being received (optional, can use productId)',
  })
  @IsUUID()
  @IsOptional()
  purchaseOrderItemId?: string; // ID del detalle de la orden

  @ApiPropertyOptional({
    description:
      'UUID of the Product being received (alternative to purchaseOrderItemId)',
  })
  @IsUUID()
  @IsOptional()
  productId?: string; // ID del producto (alternativa)

  @ApiPropertyOptional({
    description: 'Quantity received in this update',
    example: 5,
  })
  @IsInt()
  @Min(0) // Puede ser 0 si no se recibió nada de este ítem en esta recepción
  @IsNotEmpty()
  quantityReceivedNow: number;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({
    description: 'New status for the purchase order',
    enum: PurchaseOrderStatus,
  })
  @IsEnum(PurchaseOrderStatus)
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Date the order was actually received' })
  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'Updated expected delivery date' })
  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Updated notes or comments' })
  @IsString()
  @IsOptional()
  notes?: string;

  // Para marcar ítems como recibidos (parcial o totalmente)
  @ApiPropertyOptional({
    description:
      'List of items received in this update (used when status changes to PARTIALLY_RECEIVED or RECEIVED)',
    type: [ReceivePurchaseOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  @IsOptional()
  itemsReceived?: ReceivePurchaseOrderItemDto[];
}
