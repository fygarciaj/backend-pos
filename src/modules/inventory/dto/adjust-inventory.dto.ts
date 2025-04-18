import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import {
  IsInt,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsString,
  MaxLength,
  IsOptional,
  ValidateIf,
  NotEquals,
} from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({
    description: 'UUID of the product to adjust',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Type of adjustment movement',
    enum: [
      InventoryMovementType.ADJUSTMENT_IN,
      InventoryMovementType.ADJUSTMENT_OUT,
    ], // Solo permitir tipos de ajuste manual
    example: InventoryMovementType.ADJUSTMENT_OUT,
  })
  @IsEnum([
    InventoryMovementType.ADJUSTMENT_IN,
    InventoryMovementType.ADJUSTMENT_OUT,
  ])
  @IsNotEmpty()
  type:
    | InventoryMovementType.ADJUSTMENT_IN
    | InventoryMovementType.ADJUSTMENT_OUT;

  @ApiProperty({
    description:
      'Quantity to adjust (positive number). The sign is determined by the movement type.',
    example: 5,
  })
  @IsInt()
  @IsNotEmpty()
  @NotEquals(0) // La cantidad no puede ser cero
  quantity: number; // Siempre positivo en el DTO, el servicio aplicará el signo

  @ApiPropertyOptional({
    description: 'Reason for the adjustment (required for adjustments)',
    example: 'Stock count correction',
  })
  @IsString()
  @IsNotEmpty() // Razón es obligatoria para ajustes manuales
  @MaxLength(255)
  reason: string;
}
