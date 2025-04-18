import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { SaleStatus, UserRole } from '@prisma/client'; // Importar enums necesarios

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for the report period (ISO 8601)',
    example: '2023-10-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for the report period (ISO 8601)',
    example: '2023-10-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  // --- Filtros adicionales comunes ---
  @ApiPropertyOptional({ description: 'Filter by User UUID' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by Customer UUID' })
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by Product UUID' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category UUID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand UUID' })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Filter by Sale Status',
    enum: SaleStatus,
  })
  @IsEnum(SaleStatus)
  @IsOptional()
  saleStatus?: SaleStatus;

  // Podríamos añadir más filtros según sea necesario (paymentMethod, etc.)
}
