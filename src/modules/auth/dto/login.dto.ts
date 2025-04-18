import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Para documentación

export class LoginDto {
  @ApiProperty({ example: 'admin_user', description: "User's username" })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', description: "User's password" })
  @IsString()
  @IsNotEmpty()
  @MinLength(6) // Ajustar según tus reglas de contraseña
  password: string;
}
