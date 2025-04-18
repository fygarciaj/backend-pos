import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateReturnItemDto {
  @ApiProperty({
    description: 'UUID of the product being returned',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity of the product being returned',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  quantity: number;

  // Opcional: Podríamos añadir el ID del SaleDetail original si queremos más precisión
  // @ApiPropertyOptional({ description: 'UUID of the original SaleDetail item being returned' })
  // @IsUUID()
  // @IsOptional()
  // saleDetailId?: string;
}
