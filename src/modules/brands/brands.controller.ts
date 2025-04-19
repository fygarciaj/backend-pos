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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Prisma } from '@prisma/client'; // Importar Prisma para tipos

@ApiTags('Brands')
@ApiBearerAuth() // La mayoría requiere auth
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin/Manager pueden crear
  @ApiOperation({ summary: 'Create a new brand (Admin/Manager Only)' })
  @ApiResponse({ status: 201, description: 'Brand created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Slug exists).' })
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  @Public() // Permitir acceso público a la lista de marcas
  @Get()
  @ApiOperation({ summary: 'Get a list of brands (Public)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filter by name (contains)',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({
    name: 'includeProductsCount',
    required: false,
    type: Boolean,
    description: 'Include count of products in each brand',
  })
  @ApiResponse({ status: 200, description: 'List of brands.' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('name') name?: string,
    @Query('isActive') isActive?: string,
    @Query('includeProductsCount') includeProductsCount?: string,
  ) {
    const where: Prisma.BrandWhereInput = {};
    if (name) where.name = { contains: name.toLowerCase() }; // MySQL will use case-insensitive comparison by default
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.brandsService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      includeProductsCount: includeProductsCount === 'true',
      // Podrías añadir orderBy desde query params
    });
  }

  @Public() // Permitir acceso público por slug
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a brand by slug (Public)' })
  @ApiParam({ name: 'slug', description: 'URL-friendly slug of the brand' })
  @ApiResponse({ status: 200, description: 'Brand details.' })
  @ApiResponse({ status: 404, description: 'Brand not found.' })
  findBySlug(@Param('slug') slug: string) {
    return this.brandsService.findBySlug(slug);
  }

  @Get(':id')
  // Podría ser público o requerir solo autenticación básica
  // Lo dejamos protegido por defecto (requiere token válido)
  @ApiOperation({ summary: 'Get a brand by ID (Authenticated Users)' })
  @ApiParam({ name: 'id', description: 'UUID of the brand' })
  @ApiResponse({ status: 200, description: 'Brand details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Brand not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin/Manager pueden actualizar
  @ApiOperation({ summary: 'Update a brand by ID (Admin/Manager Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the brand to update' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Brand not found.' })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Slug exists).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar
  @ApiOperation({ summary: 'Delete a brand by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the brand to delete' })
  @ApiResponse({ status: 200, description: 'Brand deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Brand not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (Brand has associated products).',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.remove(id);
  }
}
