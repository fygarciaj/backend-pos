import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  IsPositive,
  IsDecimal,
} from 'class-validator';
import { SaleStatus } from '@prisma/client'; // Asumiendo que no se crea como PENDING por defecto
import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'UUID of the customer associated with the sale', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  // userId se obtendrá del usuario autenticado (req.user)

  @ApiProperty({ description: 'Payment method used', example: 'cash' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string; // efectivo, tarjeta, transferencia, etc.

  @ApiPropertyOptional({ description: 'Status of the sale', enum: SaleStatus, default: SaleStatus.COMPLETED })
  @IsEnum(SaleStatus)
  @IsOptional()
  status?: SaleStatus = SaleStatus.COMPLETED; // Por defecto, una venta creada está completada

  @ApiPropertyOptional({ description: 'Discount amount applied to the total sale', example: 5.00 })
  @IsDecimal({ decimal_digits: '2' })
  @Min(0)
  @IsOptional()
  @Type(() => String) // Para validación precisa de decimales
  discountAmount?: string = '0.00';

  @ApiPropertyOptional({ description: 'Discount percentage applied to the total sale', example: 10.0 })
  @IsDecimal({ decimal_digits: '2' })
  @Min(0)
  @IsOptional()
  @Type(() => String) // Para validación precisa de decimales
  discountPercent?: string = '0.00'; // Considerar si se aplica antes o después de impuestos

  @ApiPropertyOptional({ description: 'Notes or comments about the sale', example: 'Cliente pidió envolver para regalo.' })
  @IsString()
  @IsOptional()
  notes?: string;

  // El número de recibo/factura podría generarse automáticamente o pasarse aquí
  @ApiPropertyOptional({ description: 'Receipt or invoice number', example: 'F001-0001234' })
  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @ApiProperty({
    description: 'List of items included in the sale',
    type: [CreateSaleItemDto], // Especifica el tipo del array para Swagger
  })
  @IsArray()
  @ArrayMinSize(1) // La venta debe tener al menos un ítem
  @ValidateNested({ each: true }) // Validar cada objeto dentro del array
  @Type(() => CreateSaleItemDto) // Necesario para que class-validator valide los objetos anidados
  items: CreateSaleItemDto[];

  // Subtotal, taxes, total se calcularán en el servicio.
}
