import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductLocationQuantityDto {
  @ApiProperty({
    description: 'New quantity at location',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantityAtLocation: number;
}
