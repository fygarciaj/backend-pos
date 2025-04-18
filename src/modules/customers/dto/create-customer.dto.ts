import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
  Min,
  IsDecimal,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    example: 'Cliente Ejemplo Apellido',
    description: "Customer's full name",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @ApiPropertyOptional({
    example: '+1 555-123-4567',
    description: "Customer's phone number",
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    example: 'cliente@example.com',
    description: "Customer's email address (must be unique if provided)",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    example: 'Av. Siempreviva 742',
    description: "Customer's address",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 'frequent',
    description: 'Type of customer (e.g., occasional, frequent, wholesale)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  customerType?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Loyalty points accumulated by the customer',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  loyaltyPoints?: number = 0;

  @ApiPropertyOptional({
    example: '0.00',
    description: 'Customer account balance (if applicable)',
  })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => String) // Para validación precisa
  accountBalance?: string = '0.00';

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the customer record is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
