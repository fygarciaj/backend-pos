import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Quantity ordered',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantityOrdered: number;

  @ApiProperty({
    description: 'Unit cost price',
    example: 19.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitCostPrice: number;
}
