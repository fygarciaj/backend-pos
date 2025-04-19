import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard'; // Ajusta ruta
import { Roles } from '../auth/decorators/roles.decorator'; // Ajusta ruta
import { UserRole } from '@prisma/client';
// JwtAuthGuard es global

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Roles(UserRole.ADMIN, UserRole.MANAGER) // Eliminar REPORTS_VIEWER, solo roles válidos
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @ApiOperation({
    summary:
      'Get a summary of sales within a period (Admin/Manager/Reports Only)',
  })
  @ApiResponse({ status: 200, description: 'Sales summary report.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  // @ApiQuery para cada parámetro en ReportQueryDto si se quiere documentación detallada
  getSalesSummary(@Query() query: ReportQueryDto) {
    // El ValidationPipe global debería validar el DTO
    return this.reportsService.getSalesSummary(query);
  }

  @Get('sales-by-product')
  @ApiOperation({
    summary:
      'Get sales aggregated by product within a period (Admin/Manager/Reports Only)',
  })
  @ApiResponse({ status: 200, description: 'Sales by product report.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  getSalesByProduct(@Query() query: ReportQueryDto) {
    return this.reportsService.getSalesByProduct(query);
  }

  @Get('inventory-value')
  @ApiOperation({
    summary:
      'Get the total current inventory value based on cost price (Admin/Manager/Reports Only)',
  })
  @ApiResponse({ status: 200, description: 'Inventory value report.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  getInventoryValue(@Query() query: ReportQueryDto) {
    // Usamos ReportQueryDto aunque solo use filtros de producto/cat/marca
    return this.reportsService.getInventoryValue(query);
  }

  // Añadir endpoints para otros reportes aquí...
  // @Get('sales-by-category')
  // @Get('low-stock') // Podría llamar a InventoryService.getCurrentStockReport({ lowStockOnly: true })
}
