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
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignProductLocationDto } from './dto/assign-product-location.dto';
import { UpdateProductLocationQuantityDto } from './dto/update-product-location-quantity.dto';
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

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(RolesGuard) // Aplicar a todo el controlador
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // --- Location CRUD ---

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({
    summary: 'Create a new location (Admin/Manager/Inventory Only)',
  })
  @ApiResponse({ status: 201, description: 'Location created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 409, description: 'Conflict (Name exists).' })
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.INVENTORY_MANAGER,
    UserRole.CASHIER,
  ) // Amplio acceso para ver
  @ApiOperation({ summary: 'Get a list of locations (Authenticated Users)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by location type',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of locations.' })
  findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip?: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take?: number,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    const where: Prisma.LocationWhereInput = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return this.locationsService.findAll({ skip, take, where });
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.INVENTORY_MANAGER,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get a location by ID (Authenticated Users)' })
  @ApiParam({ name: 'id', description: 'UUID of the location' })
  @ApiResponse({ status: 200, description: 'Location details.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({
    summary: 'Update a location by ID (Admin/Manager/Inventory Only)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the location to update' })
  @ApiResponse({ status: 200, description: 'Location updated successfully.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  @ApiResponse({ status: 409, description: 'Conflict (Name exists).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN) // Solo Admin puede borrar
  @ApiOperation({ summary: 'Delete a location by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'UUID of the location to delete' })
  @ApiResponse({ status: 200, description: 'Location deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (Location has associated products).',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }

  // --- ProductLocation Management ---

  @Post('assign-product')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({
    summary:
      'Assign a product to a location (primary or specific quantity) (Admin/Manager/Inventory Only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Product assigned/updated successfully.',
  })
  @ApiResponse({ status: 404, description: 'Product or Location not found.' })
  assignProductToLocation(@Body() assignDto: AssignProductLocationDto) {
    return this.locationsService.assignProductToLocation(assignDto);
  }

  @Patch('product-quantity/:productId/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({
    summary:
      'Update the specific quantity of a product in a location (Admin/Manager/Inventory Only)',
  })
  @ApiParam({ name: 'productId', description: 'UUID of the product' })
  @ApiParam({ name: 'locationId', description: 'UUID of the location' })
  @ApiResponse({ status: 200, description: 'Quantity updated successfully.' })
  @ApiResponse({
    status: 404,
    description: 'Product/Location assignment not found.',
  })
  updateProductQuantityInLocation(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() updateDto: UpdateProductLocationQuantityDto,
  ) {
    return this.locationsService.updateProductQuantityInLocation(
      productId,
      locationId,
      updateDto,
    );
  }

  @Delete('remove-product/:productId/:locationId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @HttpCode(HttpStatus.OK) // O 204 No Content si no devuelve nada útil
  @ApiOperation({
    summary:
      'Remove a product assignment from a specific location (Admin/Manager/Inventory Only)',
  })
  @ApiParam({ name: 'productId', description: 'UUID of the product' })
  @ApiParam({ name: 'locationId', description: 'UUID of the location' })
  @ApiResponse({
    status: 200,
    description: 'Product removed successfully or was not assigned.',
  })
  @ApiResponse({
    status: 404,
    description: 'Product or Location not found (if strict).',
  }) // Depende de la implementación del servicio
  removeProductFromLocation(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.locationsService.removeProductFromLocation(
      productId,
      locationId,
    );
  }

  @Get(':id/products')
  @Roles(
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.INVENTORY_MANAGER,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary:
      'Get products associated with a specific location (Authenticated Users)',
  })
  @ApiParam({ name: 'id', description: 'UUID of the location' })
  @ApiResponse({
    status: 200,
    description: 'List of products in the location.',
  })
  @ApiResponse({ status: 404, description: 'Location not found.' })
  getProductsInLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.getProductsInLocation(id);
  }
}
