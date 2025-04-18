import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsJSON, Min, IsPositive, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Laptop Pro X1', description: 'Product name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'High-performance laptop for professionals', description: 'Product description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '1234567890123', description: 'Product barcode (must be unique)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiProperty({ example: 50, description: 'Current stock quantity' })
  @IsNumber()
  @Min(0)
  currentStock: number;

  @ApiProperty({ example: 10, description: 'Minimum stock level for alerts', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @ApiProperty({ example: 100, description: 'Maximum stock level (optional)', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  maximumStock?: number;

  @ApiProperty({ example: 'uuid-for-category', description: 'Category ID (UUID)' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'uuid-for-brand', description: 'Brand ID (UUID)', required: false })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({ type: 'array', items: { type: 'string', format: 'url' }, example: ['http://example.com/img1.jpg'], description: 'List of image URLs (up to 10)', required: false })
  @IsOptional()
  @IsJSON() // Prisma espera un string JSON, la validación real del contenido (array de URLs) se haría en el servicio o con un custom validator
  images?: string; // Almacenado como JSON `["url1", "url2"]`

  @ApiProperty({ example: 'unit', description: 'Unit of measure (e.g., unit, kg, lt, box)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  unitOfMeasure: string;

  @ApiProperty({ example: 800.50, description: 'Product cost price' })
  @IsNumber()
  @IsPositive()
  costPrice: number;

  @ApiProperty({ example: 1200.99, description: 'Product selling price' })
  @IsNumber()
  @IsPositive()
  sellingPrice: number;

  @ApiProperty({ example: true, description: 'Is the product active?', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({ example: false, description: 'Is the product featured?', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ example: 'laptop,pro,high-performance', description: 'Comma-separated tags for search', required: false })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiProperty({ example: false, description: 'Is there an active promotion?', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isPromotionActive?: boolean;

  @ApiProperty({ example: 'uuid-for-promotion', description: 'Promotion ID (if active)', required: false })
  @IsOptional()
  @IsUUID()
  @ValidateIf(o => o.isPromotionActive === true) // Validar solo si isPromotionActive es true
  @IsNotEmpty({ message: 'promotionId is required when isPromotionActive is true' })
  promotionId?: string;

  @ApiProperty({ example: 1.5, description: 'Product weight (optional)', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @ApiProperty({ example: '30x20x2 cm', description: 'Product dimensions (optional)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dimensions?: string;

  @ApiProperty({ example: 'LPX1-BLK', description: 'Stock Keeping Unit (must be unique)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ type: 'object', example: '{"color": "Black", "size": "15 inch"}', description: 'JSON object for product variants (optional)', required: false })
  @IsOptional()
  @IsJSON()
  variants?: string; // Almacenado como JSON
}
