import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsDecimal,
  Min,
} from 'class-validator';
import { CreateReturnItemDto } from './create-return-item.dto';

export class CreateReturnDto {
  @ApiProperty({
    description: 'UUID of the original sale being returned against',
    example: 'uuid-sale-1',
  })
  @IsUUID()
  @IsNotEmpty()
  originalSaleId: string;

  @ApiProperty({
    description: 'Reason for the return',
    example: 'Producto defectuoso',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Total amount refunded to the customer',
    example: '49.99',
  })
  @IsDecimal({ decimal_digits: '2' })
  @Min(0) // Puede ser 0 si es un cambio sin reembolso monetario
  @IsOptional() // Podría calcularse o requerirse
  @Type(() => String)
  amountRefunded?: string = '0.00'; // Default a 0

  @ApiProperty({
    description: 'List of items being returned',
    type: [CreateReturnItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];

  // processedByUserId se obtendrá del usuario autenticado
  // returnDate se establecerá automáticamente
}
