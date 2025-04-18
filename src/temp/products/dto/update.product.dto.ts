import { PartialType } from '@nestjs/mapped-types'; // O @nestjs/swagger
import { CreateProductDto } from './create-product.dto';
import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductDto extends PartialType(CreateProductDto) {
    // Permitir explícitamente que brandId sea null para desconectar la marca
    @ApiProperty({ example: 'uuid-for-brand | null', description: 'Brand ID (UUID) or null to remove brand', required: false, nullable: true })
    @IsOptional()
    @IsUUID()
    brandId?: string | null; // Cambiado para permitir null
}
