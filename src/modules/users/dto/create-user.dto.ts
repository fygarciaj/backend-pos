import { IsString, IsNotEmpty, MinLength, IsEnum, IsOptional, IsBoolean, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger'; // Para documentación OpenAPI/Swagger

export class CreateUserDto {
  @ApiProperty({ example: 'john_doe', description: 'Unique username' })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'Password123!', description: 'User password (at least 8 characters, one uppercase, one lowercase, one number, one special character)' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
      message: 'Password too weak. Must contain uppercase, lowercase, number, and special character.'
  })
  password: string; // Se hasheará en el servicio

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CASHIER, description: 'User role' })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: true, description: 'User status (active/inactive)', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
