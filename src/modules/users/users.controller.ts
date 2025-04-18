import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards, // Importar UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
// JwtAuthGuard ya es global, no necesitamos importarlo aquí a menos que quitemos el global
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; // Importar RolesGuard
import { Roles } from '../auth/decorators/roles.decorator'; // Importar Roles decorator
import { UserRole } from '@prisma/client'; // Importar enum de roles

@ApiTags('Users')
@ApiBearerAuth() // Indicar que requiere autenticación
@Controller('users')
// @UseGuards(RolesGuard) // Podrías aplicar RolesGuard a todo el controlador si quieres
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard) // Aplicar RolesGuard a este método
  @Roles(UserRole.ADMIN) // Solo Admin puede crear usuarios
  @ApiOperation({ summary: 'Create a new user (Admin Only)' })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., username exists).',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Admin y Manager pueden ver la lista
  @ApiOperation({ summary: 'Get all users (Admin/Manager Only)' })
  @ApiResponse({ status: 200, description: 'List of users.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Admin y Manager pueden ver detalles
  @ApiOperation({ summary: 'Get a user by ID (Admin/Manager Only)' })
  @ApiResponse({ status: 200, description: 'User details.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    // Podrías añadir lógica para que un usuario pueda ver su propio perfil
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN) // Solo Admin puede modificar cualquier usuario
  @ApiOperation({ summary: 'Update a user by ID (Admin Only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., username exists).',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Podrías añadir lógica para que un usuario pueda modificar su propio perfil
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar usuarios
  @ApiOperation({ summary: 'Delete a user by ID (Admin Only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (cannot delete due to dependencies).',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
