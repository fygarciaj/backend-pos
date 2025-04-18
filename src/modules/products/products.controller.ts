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
  NotFoundException,
  UseGuards, // Importar UseGuards
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
// JwtAuthGuard es global
import { RolesGuard } from '../../auth/guards/roles.guard'; // Importar RolesGuard
import { Roles } from '../../auth/decorators/roles.decorator'; // Importar Roles decorator
import { UserRole } from '@prisma/client'; // Importar enum de roles

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard) // Aplicar RolesGuard
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles permitidos para crear
  @ApiOperation({
    summary: 'Create a new product (Admin/Manager/Inventory Only)',
  })
  @ApiResponse({
    status: 201,
    description: 'The product has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  create(@Body() createProductDto: CreateProductDto) {
    // const userId = req.user.userId; // Obtener ID del usuario si es necesario loguear quién creó
    return this.productsService.create(createProductDto);
  }

  @Get()
  // No se necesita @Roles() aquí si todos los usuarios autenticados pueden ver productos
  // JwtAuthGuard global ya protege esta ruta
  @ApiOperation({ summary: 'Get a list of products (Authenticated Users)' })
  // ... (ApiQuery y ApiResponse como estaban) ...
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('isActive') isActive?: string,
  ) {
    // ... (lógica del controlador como estaba) ...
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const pagination = {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    };
    return this.productsService.findAll({ ...pagination, where });
  }

  @Get(':id')
  // No se necesita @Roles() si todos los usuarios autenticados pueden ver detalles
  @ApiOperation({ summary: 'Get a product by ID (Authenticated Users)' })
  // ... (ApiResponse como estaban) ...
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productsService.findOne(id);
    return product;
  }

  @Get('barcode/:barcode')
  // No se necesita @Roles() si todos los usuarios autenticados pueden buscar por barcode
  @ApiOperation({ summary: 'Get a product by barcode (Authenticated Users)' })
  // ... (ApiResponse como estaban) ...
  async findByBarcode(@Param('barcode') barcode: string) {
    const product = await this.productsService.findByBarcode(barcode);
    return product;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER) // Roles permitidos para actualizar
  @ApiOperation({
    summary: 'Update a product by ID (Admin/Manager/Inventory Only)',
  })
  // ... (ApiResponse como estaban) ...
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin y Manager pueden borrar (quizás solo Admin?)
  @ApiOperation({ summary: 'Delete a product by ID (Admin/Manager Only)' })
  // ... (ApiResponse como estaban) ...
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
