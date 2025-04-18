import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Marca Ejemplo', description: 'Name of the brand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'marca-ejemplo',
    description: 'URL-friendly slug (auto-generated if not provided)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  // Add validation for slug format if needed
  slug?: string;

  @ApiPropertyOptional({
    example: 'Una breve descripción de la marca.',
    description: 'Short description of the brand',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logos/marca-ejemplo.png',
    description: 'URL for the brand logo',
  })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://www.marca-ejemplo.com',
    description: 'Official website URL of the brand',
  })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the brand is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    example: 'Notas internas sobre la marca.',
    description: 'Internal notes (not public)',
  })
  @IsString()
  @IsOptional()
  internalNotes?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Order for display purposes',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number = 0;

  @ApiPropertyOptional({
    example: 'Marca Ejemplo | Mi Tienda',
    description: 'Meta title for SEO',
  })
  @IsString()
  @IsOptional()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({
    example: 'Productos de alta calidad de Marca Ejemplo.',
    description: 'Meta description for SEO',
  })
  @IsString()
  @IsOptional()
  @MaxLength(160)
  metaDescription?: string;

  // Relaciones (ej: suppliers) se manejarán en sus respectivos módulos o con IDs separados si es necesario aquí.
}
