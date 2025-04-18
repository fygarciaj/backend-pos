import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsUUID, Min } from 'class-validator';

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
  @IsPositive() // Debe ser al menos 1
  @Min(1)
  quantity: number;

  // El precio unitario se tomará del producto en el momento de la venta en el servicio.
  // Los descuentos/impuestos por ítem se pueden añadir aquí más adelante si es necesario.
}
