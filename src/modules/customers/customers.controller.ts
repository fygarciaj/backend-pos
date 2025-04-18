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
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import { UserRole, Prisma } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER) // Roles que pueden crear clientes
  @ApiOperation({
    summary: 'Create a new customer (Admin/Manager/Cashier Only)',
  })
  @ApiResponse({ status: 201, description: 'Customer created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 409, description: 'Conflict (Email exists).' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.REPORTS_VIEWER,
  ) // Roles que pueden ver lista
  @ApiOperation({
    summary: 'Get a list of customers (Admin/Manager/Cashier/Reports Only)',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name, email, or phone',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of customers.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const where: Prisma.CustomerWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.customersService.findAll({
      skip,
      take,
      where,
      // Podrías añadir orderBy desde query params
    });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.REPORTS_VIEWER,
  ) // Roles que pueden ver detalles
  @ApiOperation({
    summary: 'Get a customer by ID (Admin/Manager/Cashier/Reports Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the customer' })
  @ApiQuery({
    name: 'includeSales',
    required: false,
    type: Boolean,
    description: 'Include recent sales history',
    example: false,
  })
  @ApiResponse({ status: 200, description: 'Customer details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeSales', new DefaultValuePipe(false), ParseBoolPipe)
    includeSales?: boolean,
  ) {
    return this.customersService.findOne(id, includeSales);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Roles que pueden actualizar
  @ApiOperation({ summary: 'Update a customer by ID (Admin/Manager Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the customer to update' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({ status: 409, description: 'Conflict (Email exists).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar (o desactivar)
  @ApiOperation({ summary: 'Delete a customer by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the customer to delete' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (Customer has associated sales).',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }
}
