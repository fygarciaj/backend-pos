import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
// import { RolesGuard } from '../common/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';
// import { UserRole } from '@prisma/client';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // Proteger todas las rutas
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  // @Roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER)
  // @UseGuards(RolesGuard)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get a list of products' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, SKU, tags' })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'brandId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean, description: 'Filter products with stock > 0' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('isActive') isActive?: string, // Recibido como string, convertir a boolean en servicio
    @Query('inStock') inStock?: string,   // Recibido como string, convertir a boolean en servicio
  ) {
    const pagination = { page: page || 1, limit: limit || 10 };
    const filters = { search, categoryId, brandId, isActive, inStock };
    return this.productsService.findAll(pagination, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)', type: String })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)', type: String })
  // @Roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER)
  // @UseGuards(RolesGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)', type: String })
  // @Roles(UserRole.ADMIN)
  // @UseGuards(RolesGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    // Considerar borrado lógico (isActive = false)
    return this.productsService.remove(id);
  }

  // --- Rutas Adicionales (Ejemplos) ---

  @Get('stock/low')
  @ApiOperation({ summary: 'Get products with low stock (below minimum)' })
  // @Roles(UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.MANAGER)
  // @UseGuards(RolesGuard)
  findLowStockProducts() {
      return this.productsService.findLowStock();
  }

   @Get('sku/:sku')
   @ApiOperation({ summary: 'Get a product by SKU' })
   @ApiParam({ name: 'sku', description: 'Product Stock Keeping Unit', type: String })
   findBySku(@Param('sku') sku: string) {
     return this.productsService.findBySku(sku);
   }

   @Get('barcode/:barcode')
   @ApiOperation({ summary: 'Get a product by Barcode' })
   @ApiParam({ name: 'barcode', description: 'Product Barcode', type: String })
   findByBarcode(@Param('barcode') barcode: string) {
     return this.productsService.findByBarcode(barcode);
   }
}
