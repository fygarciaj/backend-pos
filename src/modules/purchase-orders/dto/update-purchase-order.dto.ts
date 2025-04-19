import { ApiPropertyOptional, ApiProperty, PartialType } from '@nestjs/swagger';
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
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { PurchaseOrderStatus } from '@prisma/client';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';

// DTO para actualizar la cantidad recibida de un ítem específico
export class ReceivePurchaseOrderItemDto {
  @ApiProperty({
    description: 'ID of the specific purchase order item',
    required: false,
  })
  @IsOptional()
  @IsString()
  purchaseOrderItemId?: string;

  @ApiProperty({
    description: 'ID of the product being received',
    required: false,
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    description: 'Quantity being received in this update',
    example: 5,
  })
  @IsNotEmpty()
  @IsNumber()
  quantityReceivedNow: number;
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {
  @ApiProperty({
    enum: PurchaseOrderStatus,
    description: 'New status for the purchase order',
    required: false,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiProperty({
    description: 'Expected delivery date',
    required: false,
  })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Date when items were received',
    required: false,
  })
  @IsOptional()
  @IsString()
  receivedDate?: string;

  @ApiProperty({
    type: [ReceivePurchaseOrderItemDto],
    description: 'Items being received in this update',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  itemsReceived?: ReceivePurchaseOrderItemDto[];
}
