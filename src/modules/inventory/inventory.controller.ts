import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ParseBoolPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import { UserRole, Prisma, InventoryMovementType } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjustments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden ajustar stock
  @ApiOperation({
    summary:
      'Perform a manual inventory adjustment (Admin/Manager/Inventory Only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Inventory adjusted successfully, returns updated product.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (Validation Error, e.g., negative quantity, missing reason).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Product).' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., Insufficient Stock for ADJUSTMENT_OUT).',
  })
  adjustStock(@Body() adjustInventoryDto: AdjustInventoryDto, @Request() req) {
    const userId = req.user.userId;
    return this.inventoryService.adjustStock(adjustInventoryDto, userId);
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden ver movimientos
  @ApiOperation({
    summary: 'Get a list of inventory movements (Admin/Manager/Inventory Only)',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'productId',
    required: false,
    type: String,
    description: 'Filter by product UUID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by user UUID who performed the movement',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: InventoryMovementType,
    description: 'Filter by movement type',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter movements from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter movements up to this date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'List of inventory movements.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  getInventoryMovements(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take?: number,
    @Query('productId') productId?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: InventoryMovementType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (productId) where.productId = productId;
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.movementDate = {};
      if (startDate) where.movementDate.gte = new Date(startDate);
      if (endDate) where.movementDate.lte = new Date(endDate);
    }

    return this.inventoryService.getInventoryMovements({
      skip,
      take,
      where,
      // Podrías añadir orderBy desde query params
    });
  }

  @Get('report/current-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles que pueden ver reportes de stock
  @ApiOperation({
    summary: 'Get current stock levels report (Admin/Manager/Inventory Only)',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'lowStockOnly',
    required: false,
    type: Boolean,
    description: 'Filter to show only products at or below minimum stock',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category UUID',
  })
  @ApiQuery({
    name: 'brandId',
    required: false,
    type: String,
    description: 'Filter by brand UUID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by product name, SKU, or barcode',
  })
  @ApiResponse({
    status: 200,
    description: 'List of products with current stock levels.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  getCurrentStockReport(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take?: number,
    @Query('lowStockOnly', new DefaultValuePipe(false), ParseBoolPipe)
    lowStockOnly?: boolean,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.getCurrentStockReport({
      skip,
      take,
      lowStockOnly,
      categoryId,
      brandId,
      search,
    });
  }
}
