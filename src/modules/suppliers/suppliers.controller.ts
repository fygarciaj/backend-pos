import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, Prisma } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Suppliers')
@ApiBearerAuth() // La mayoría requiere auth
@UseGuards(RolesGuard) // Aplicar RolesGuard a todo el controlador (la mayoría de ops son restringidas)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden crear proveedores
  @ApiOperation({ summary: 'Create a new supplier (Admin/Manager/Inventory Only)' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Related Brand ID).' })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Email exists).' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.REPORTS_VIEWER) // Roles que pueden ver la lista
  @ApiOperation({ summary: 'Get a list of suppliers (Admin/Manager/Inventory/Reports Only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filter by name (contains)' })
  @ApiQuery({ name: 'email', required: false, type: String, description: 'Filter by email (contains)' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'includeRelations', required: false, type: Boolean, description: 'Include counts and basic relation info' })
  @ApiResponse({ status: 200, description: 'List of suppliers.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('isActive') isActive?: string,
    @Query('includeRelations') includeRelations?: string,
  ) {
    const where: Prisma.SupplierWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.suppliersService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      includeRelations: includeRelations === 'true',
      // Podrías añadir orderBy desde query params
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.REPORTS_VIEWER) // Roles que pueden ver detalles
  @ApiOperation({ summary: 'Get a supplier by ID (Admin/Manager/Inventory/Reports Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the supplier' })
  @ApiQuery({ name: 'includeRelations', required: false, type: Boolean, description: 'Include related brands and purchase orders', example: true })
  @ApiResponse({ status: 200, description: 'Supplier details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  findOne(
      @Param('id', ParseUUIDPipe) id: string,
      @Query('includeRelations') includeRelations?: string,
    ) {
    return this.suppliersService.findOne(id, includeRelations === 'true');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden actualizar
  @ApiOperation({ summary: 'Update a supplier by ID (Admin/Manager/Inventory Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the supplier to update' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Supplier or related Brand ID).' })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Email exists).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar proveedores
  @ApiOperation({ summary: 'Delete a supplier by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the supplier to delete' })
  @ApiResponse({ status: 200, description: 'Supplier deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Supplier not found.' })
  @ApiResponse({ status: 409, description: 'Conflict (Supplier has associated purchase orders).' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.remove(id);
  }
}
