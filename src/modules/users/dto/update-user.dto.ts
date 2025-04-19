import { PartialType } from '@nestjs/mapped-types'; // O @nestjs/swagger
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Sobrescribir password para hacerlo opcional y mantener validación si se provee
  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New user password (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password too weak. Must contain uppercase, lowercase, number, and special character.',
  })
  password?: string;

  @ApiProperty({
    example: '2025-04-19T22:17:27.000Z',
    description: 'Last login timestamp',
    required: false,
  })
  @IsOptional()
  lastLogin?: Date;
}

// Alternativa sin PartialType (más explícito):
// export class UpdateUserDto {
//   @IsOptional()
//   @IsString()
//   @MinLength(3)
//   username?: string;

//   @IsOptional()
//   @IsString()
//   @MinLength(8)
//   @Matches(...)
//   password?: string;

//   @IsOptional()
//   @IsString()
//   fullName?: string;

//   @IsOptional()
//   @IsEnum(UserRole)
//   role?: UserRole;

//   @IsOptional()
//   @IsBoolean()
//   isActive?: boolean;
// }
