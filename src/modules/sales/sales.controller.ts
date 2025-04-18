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
  Request, // Para obtener el usuario autenticado
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, Prisma } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Sales')
@ApiBearerAuth() // Todas las operaciones de ventas requieren autenticación
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER) // Roles que pueden crear ventas
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale (Admin/Manager/Cashier Only)' })
  @ApiResponse({ status: 201, description: 'Sale created successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (Validation Error, e.g., invalid input).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Product or Customer).' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., Insufficient Stock).',
  })
  create(@Body() createSaleDto: CreateSaleDto, @Request() req) {
    const userId = req.user.userId; // Obtener ID del usuario desde el payload del token JWT
    if (!userId) {
      throw new Error('User ID not found in token payload.'); // Seguridad extra
    }
    return this.salesService.create(createSaleDto, userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.REPORTS_VIEWER) // Roles que pueden ver lista de ventas
  @ApiOperation({ summary: 'Get a list of sales (Admin/Manager/Reports Only)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer UUID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by user UUID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserRole,
    description: 'Filter by sale status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter sales from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter sales up to this date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'List of sales.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('customerId') customerId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: Prisma.SaleStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: Prisma.SaleWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }

    return this.salesService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      // Podrías añadir orderBy desde query params (ej: ?orderBy=total&orderDirection=desc)
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.CASHIER,
    UserRole.REPORTS_VIEWER,
  ) // Roles que pueden ver detalles
  @ApiOperation({
    summary: 'Get a sale by ID (Admin/Manager/Cashier/Reports Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the sale' })
  @ApiResponse({ status: 200, description: 'Sale details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Sale not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin/Manager pueden actualizar estado/notas
  @ApiOperation({
    summary: 'Update a sale (e.g., status, notes) (Admin/Manager Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the sale to update' })
  @ApiResponse({ status: 200, description: 'Sale updated successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (Validation Error or Invalid Operation).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Sale not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSaleDto: UpdateSaleDto,
    @Request() req,
  ) {
    const userId = req.user.userId; // Obtener ID del usuario que realiza la actualización
    return this.salesService.update(id, updateSaleDto, userId);
  }

  // @Delete(':id')
  // @UseGuards(RolesGuard)
  // @Roles(UserRole.ADMIN) // Quizás solo Admin puede "borrar" (que debería ser cancelar)
  // @ApiOperation({ summary: 'Delete/Cancel a sale by ID (Admin Only)' })
  // remove(@Param('id', ParseUUIDPipe) id: string) {
  //   // return this.salesService.remove(id); // Implementar cancelación segura
  // }
}
