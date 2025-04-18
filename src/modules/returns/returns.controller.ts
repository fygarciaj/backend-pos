import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
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

@ApiTags('Returns')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER) // Roles que pueden procesar devoluciones
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Process a new customer return (Admin/Manager/Cashier Only)',
  })
  @ApiResponse({ status: 201, description: 'Return processed successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (Validation Error, e.g., invalid quantity).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 404,
    description: 'Not Found (Original Sale or Product).',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., Sale already refunded/cancelled).',
  })
  create(@Body() createReturnDto: CreateReturnDto, @Request() req) {
    const userId = req.user.userId;
    return this.returnsService.create(createReturnDto, userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.REPORTS_VIEWER) // Roles que pueden ver lista de devoluciones
  @ApiOperation({
    summary: 'Get a list of returns (Admin/Manager/Reports Only)',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'originalSaleId',
    required: false,
    type: String,
    description: 'Filter by original sale UUID',
  })
  @ApiQuery({
    name: 'processedByUserId',
    required: false,
    type: String,
    description: 'Filter by user UUID who processed the return',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter returns from this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter returns up to this date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'List of returns.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take?: number,
    @Query('originalSaleId') originalSaleId?: string,
    @Query('processedByUserId') processedByUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: Prisma.ReturnWhereInput = {};
    if (originalSaleId) where.originalSaleId = originalSaleId;
    if (processedByUserId) where.processedByUserId = processedByUserId;
    if (startDate || endDate) {
      where.returnDate = {};
      if (startDate) where.returnDate.gte = new Date(startDate);
      if (endDate) where.returnDate.lte = new Date(endDate);
    }

    return this.returnsService.findAll({
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
    summary: 'Get a return by ID (Admin/Manager/Cashier/Reports Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the return record' })
  @ApiResponse({ status: 200, description: 'Return details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Return not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.returnsService.findOne(id);
  }

  // PATCH y DELETE generalmente no se implementan para devoluciones procesadas.
}
