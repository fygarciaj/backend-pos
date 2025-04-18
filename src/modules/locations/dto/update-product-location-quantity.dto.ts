import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateProductLocationQuantityDto {
  @ApiProperty({
    description: 'New quantity for the product at this location',
    example: 15,
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  quantityInLocation: number;
}
