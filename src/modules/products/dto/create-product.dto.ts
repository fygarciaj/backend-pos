import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  IsBoolean,
  IsDecimal,
  MaxLength,
  IsPositive,
  IsArray,
  ValidateNested,
  IsUrl,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO para la imagen (si se suben junto con el producto)
export class ProductImageDto {
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  order?: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  barcode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  currentStock?: number = 0;

  @IsInt()
  @Min(0)
  @IsOptional()
  minStock?: number = 0;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxStock?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unitOfMeasure: string; // ej: unidad, kg, litro, caja

  @IsDecimal({ decimal_digits: '2' })
  @IsPositive()
  @Type(() => String) // Asegura conversión si viene como string
  costPrice: string; // Usar string para decimales precisos con class-validator

  @IsDecimal({ decimal_digits: '2' })
  @IsPositive()
  @Type(() => String) // Asegura conversión si viene como string
  sellingPrice: string; // Usar string para decimales precisos con class-validator

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean = false;

  @IsString()
  @IsOptional()
  tags?: string; // Palabras clave separadas por comas

  @IsBoolean()
  @IsOptional()
  promotionIsActive?: boolean = false;

  @IsString()
  @IsOptional()
  promotionId?: string;

  @IsDecimal({ decimal_digits: '3' })
  @IsPositive()
  @IsOptional()
  @Type(() => String)
  weight?: string; // ej: en kg

  @IsString()
  @IsOptional()
  dimensions?: string; // ej: "10x20x30 cm"

  @IsObject() // O IsString() si esperas un JSON stringificado
  @IsOptional()
  variants?: any; // Usar 'any' o un DTO específico para variantes

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  brandId: string;

  @IsString()
  @IsOptional()
  locationId?: string; // Ubicación principal opcional

  // Si permites crear imágenes al mismo tiempo
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];
}
