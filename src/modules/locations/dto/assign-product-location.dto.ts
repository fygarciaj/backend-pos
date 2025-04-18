import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class AssignProductLocationDto {
  @ApiProperty({ description: 'UUID of the Product' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'UUID of the Location' })
  @IsUUID()
  @IsNotEmpty()
  locationId: string;

  @ApiPropertyOptional({
    description:
      'Quantity of the product at this specific location (required if using ProductLocation table)',
    example: 10,
  })
  @IsInt()
  @Min(0) // Puede ser 0 si se quiere registrar la ubicación sin stock inicial
  @IsNotEmpty() // Requerido si usamos la tabla intermedia ProductLocation
  quantityInLocation?: number = 0;
}
