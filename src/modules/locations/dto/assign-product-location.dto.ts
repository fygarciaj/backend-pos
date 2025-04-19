import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class AssignProductLocationDto {
  @ApiProperty({
    description: 'Product ID to assign to location',
  })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Location ID where to assign the product',
  })
  @IsString()
  locationId: string;

  @ApiProperty({
    description: 'Quantity at this location',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  quantityAtLocation?: number;
}
