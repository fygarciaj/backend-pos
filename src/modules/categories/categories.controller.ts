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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
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
import { UserRole } from '@prisma/client';
import { Public } from '../../auth/decorators/public.decorator'; // Para permitir acceso público a la lista/árbol

@ApiTags('Categories')
@ApiBearerAuth() // La mayoría requiere auth, excepto las marcadas con @Public
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin/Manager pueden crear
  @ApiOperation({ summary: 'Create a new category (Admin/Manager Only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Not Found (Parent Category).' })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Slug exists).' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Public() // Permitir acceso público a la lista de categorías
  @Get()
  @ApiOperation({ summary: 'Get a list of categories (Public)' })
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
    description: 'Include count of products in each category',
  })
  @ApiQuery({
    name: 'includeChildren',
    required: false,
    type: Boolean,
    description: 'Include direct children categories',
  })
  @ApiResponse({ status: 200, description: 'List of categories.' })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('name') name?: string,
    @Query('isActive') isActive?: string,
    @Query('includeProductsCount') includeProductsCount?: string,
    @Query('includeChildren') includeChildren?: string,
  ) {
    const where: Prisma.CategoryWhereInput = {};
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.categoriesService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
      includeProductsCount: includeProductsCount === 'true',
      includeChildren: includeChildren === 'true',
      // Podrías añadir orderBy desde query params
    });
  }

  @Public() // Permitir acceso público al árbol de categorías
  @Get('tree')
  @ApiOperation({ summary: 'Get category tree structure (Public)' })
  @ApiResponse({ status: 200, description: 'Hierarchical list of categories.' })
  getTree() {
    return this.categoriesService.getCategoryTree();
  }

  @Public() // Permitir acceso público por slug
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a category by slug (Public)' })
  @ApiParam({ name: 'slug', description: 'URL-friendly slug of the category' })
  @ApiResponse({ status: 200, description: 'Category details.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':id')
  // Podría ser público o requerir solo autenticación básica si se usa en el frontend
  // Por ahora, lo dejamos protegido por defecto (requiere token válido)
  @ApiOperation({ summary: 'Get a category by ID (Authenticated Users)' })
  @ApiParam({ name: 'id', description: 'UUID of the category' })
  @ApiResponse({ status: 200, description: 'Category details.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER) // Solo Admin/Manager pueden actualizar
  @ApiOperation({ summary: 'Update a category by ID (Admin/Manager Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the category to update' })
  @ApiResponse({ status: 200, description: 'Category updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (Validation Error).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({
    status: 404,
    description: 'Not Found (Category or Parent Category).',
  })
  @ApiResponse({ status: 409, description: 'Conflict (Name or Slug exists).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar
  @ApiOperation({ summary: 'Delete a category by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the category to delete' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Insufficient Role).' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (Category has products or subcategories).',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
