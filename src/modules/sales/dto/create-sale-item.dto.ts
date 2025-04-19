import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateSaleItemDto {
  @ApiProperty({
    description: 'UUID of the product being sold',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product being sold',
    example: 2,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Tax rate percentage for this item',
    example: 18,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Unit price for this item (if different from product price)',
    example: 10.99,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({
    description: 'Discount amount for this item',
    example: 5,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  itemDiscountAmount?: number;
}
