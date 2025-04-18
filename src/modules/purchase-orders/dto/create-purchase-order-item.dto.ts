import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  Min,
  IsDecimal,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({
    description: 'UUID of the product being ordered',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product being ordered',
    example: 10,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  quantityOrdered: number;

  @ApiProperty({
    description: 'Purchase price per unit for this item',
    example: '25.50',
  })
  @IsDecimal({ decimal_digits: '2' }) // Validar como string para precisión
  @IsPositive()
  @Type(() => String)
  purchasePrice: string; // Precio de compra unitario
}
