import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MovementType } from '@prisma/client';

export class AdjustInventoryDto {
  @ApiProperty({ example: 'product-uuid', description: 'Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({
    enum: MovementType,
    example: MovementType.POSITIVE_ADJUSTMENT,
    description: 'Type of inventory movement',
  })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiProperty({
    example: 5,
    description: 'Quantity to adjust (positive or negative)',
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: 'Stock count adjustment',
    description: 'Reason for adjustment',
    required: false,
  })
  @IsOptional()
  @IsString()
  adjustmentReason?: string;
}
