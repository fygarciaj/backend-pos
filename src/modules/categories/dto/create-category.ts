import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUrl,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electrónicos', description: 'Name of the category' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Dispositivos y gadgets electrónicos', description: 'Optional description for the category' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/electronics.jpg', description: 'URL for the category image' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'electronicos', description: 'URL-friendly slug (auto-generated if not provided)' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  // Add validation for slug format if needed (e.g., using matches)
  slug?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', description: 'ID of the parent category for hierarchy' })
  @IsUUID()
  @IsOptional()
  parentCategoryId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Order for display purposes' })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number = 0;

  @ApiPropertyOptional({ example: true, description: 'Whether the category is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({ example: 'Electrónicos | Mi Tienda', description: 'Meta title for SEO' })
  @IsString()
  @IsOptional()
  @MaxLength(70)
  metaTitle?: string;

  @ApiPropertyOptional({ example: 'Compra los mejores dispositivos electrónicos.', description: 'Meta description for SEO' })
  @IsString()
  @IsOptional()
  @MaxLength(160)
  metaDescription?: string;

  @ApiPropertyOptional({ example: 'electronica, gadgets, tecnologia', description: 'Keywords for SEO and internal search' })
  @IsString()
  @IsOptional()
  keywords?: string;
}
