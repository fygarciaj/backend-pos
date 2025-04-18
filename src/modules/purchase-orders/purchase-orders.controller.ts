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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RolesGuard } from '../modules/auth/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../modules/auth/decorators/roles.decorator'; // Ajusta ruta
import { UserRole, Prisma, PurchaseOrderStatus } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden crear órdenes
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new purchase order (Admin/Manager/Inventory Only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Purchase order created successfully.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Supplier or Product).' })
  create(
    @Body() createPurchaseOrderDto: CreatePurchaseOrderDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.purchaseOrdersService.create(createPurchaseOrderDto, userId);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.INVENTORY_MANAGER,
    UserRole.REPORTS_VIEWER,
  ) // Roles que pueden ver lista
  @ApiOperation({
    summary:
      'Get a list of purchase orders (Admin/Manager/Inventory/Reports Only)',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    type: String,
    description: 'Filter by supplier UUID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PurchaseOrderStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter orders from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter orders up to this date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'List of purchase orders.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.orderDate = {}; // Filtrar por fecha de orden
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    return this.purchaseOrdersService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      // Podrías añadir orderBy desde query params
    });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.INVENTORY_MANAGER,
    UserRole.REPORTS_VIEWER,
  ) // Roles que pueden ver detalles
  @ApiOperation({
    summary:
      'Get a purchase order by ID (Admin/Manager/Inventory/Reports Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the purchase order' })
  @ApiResponse({ status: 200, description: 'Purchase order details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Purchase order not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden actualizar/recibir
  @ApiOperation({
    summary:
      'Update a purchase order (status, notes, receive items) (Admin/Manager/Inventory Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the purchase order to update' })
  @ApiResponse({
    status: 200,
    description: 'Purchase order updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (Validation Error, Invalid Quantity Received).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 404,
    description: 'Not Found (Purchase Order or Item).',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflict (e.g., trying to update a received/cancelled order).',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    return this.purchaseOrdersService.update(
      id,
      updatePurchaseOrderDto,
      userId,
    );
  }

  // @Delete(':id')
  // @Roles(UserRole.ADMIN) // Solo Admin puede borrar (cancelar)
  // @ApiOperation({ summary: 'Delete/Cancel a purchase order by ID (Admin Only)' })
  // remove(@Param('id', ParseUUIDPipe) id: string) {
  //   // Implementar cancelación segura si es necesario
  // }
}
