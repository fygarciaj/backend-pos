import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({
    example: 'Almacén Principal - Estante A1',
    description: 'Unique name for the location',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    example: 'warehouse',
    description: 'Type of location (e.g., warehouse, store_floor, back_office)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    example: 'Estante superior izquierdo para productos pequeños.',
    description: 'Optional description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Optional capacity (e.g., number of items, volume)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    example: 'Lat: 40.7128, Lon: -74.0060',
    description: 'Optional coordinates or internal map reference',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  coordinates?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the location is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
