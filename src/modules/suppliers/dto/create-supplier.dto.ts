import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'Proveedor ABC S.L.',
    description: 'Name of the supplier',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Main contact person at the supplier',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional({
    example: '+34 912 345 678',
    description: 'Supplier phone number',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    example: 'contacto@proveedorabc.com',
    description: 'Supplier email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'Calle Falsa 123, 28080 Madrid, España',
    description: 'Supplier physical or fiscal address',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 'Pago a 30 días neto.',
    description: 'Payment terms agreed with the supplier',
  })
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the supplier is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  // Relación con Marcas (Brands) - Opcional al crear, se puede gestionar después
  @ApiPropertyOptional({
    description: 'List of Brand UUIDs that this supplier provides',
    example: ['uuid-brand-1', 'uuid-brand-2'],
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true }) // Validar que cada elemento sea un UUID
  @IsOptional()
  brandIds?: string[];
}
