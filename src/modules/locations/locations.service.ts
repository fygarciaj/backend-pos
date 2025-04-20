import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignProductLocationDto } from './dto/assign-product-location.dto';
import { UpdateProductLocationQuantityDto } from './dto/update-product-location-quantity.dto';
import { Prisma, Location, ProductLocation } from '@prisma/client';

interface DbError {
  code?: string;
  message?: string;
  stack?: string;
  meta?: { target?: string[] };
}

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Location CRUD ---

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const { name } = createLocationDto;

    if (!name) {
      throw new ConflictException('Name is required');
    }

    const existingName = await this.prisma.location.findUnique({
      where: { name },
    });
    if (existingName) {
      throw new ConflictException(
        `Location with name "${name}" already exists.`,
      );
    }

    try {
      this.logger.log(`Creating location: ${name}`);
      return await this.prisma.location.create({ data: createLocationDto });
    } catch (error) {
      this.handleDbError(error as DbError, { name });
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.LocationWhereUniqueInput;
    where?: Prisma.LocationWhereInput;
    orderBy?: Prisma.LocationOrderByWithRelationInput;
  }): Promise<Location[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.location.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { name: 'asc' },
      include: {
        _count: { select: { productsAtLocation: true } },
      },
    });
  }

  async findOne(id: string): Promise<Location | null> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        productsAtLocation: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                currentStock: true,
              },
            },
          },
        },
        _count: {
          select: { productsAtLocation: true },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    return location;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<Location> {
    await this.findOne(id); // Check existence

    const { name, ...locationData } = updateLocationDto;
    const dataToUpdate: Prisma.LocationUpdateInput = { ...locationData };

    if (name) {
      const existingName = await this.prisma.location.findFirst({
        where: { name, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException(
          `Location with name "${name}" already exists.`,
        );
      }
      dataToUpdate.name = name;
      try {
        this.logger.log(`Updating location ID: ${id}`);
        return await this.prisma.location.update({
          where: { id },
          data: dataToUpdate,
        });
      } catch (error) {
        this.handleDbError(error as DbError, { name });
      }
    }

    try {
      this.logger.log(`Updating location ID: ${id}`);
      return await this.prisma.location.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      this.handleDbError(error as DbError);
    }
  }

  async remove(id: string): Promise<Location> {
    const locationToDelete = await this.prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: { productsAtLocation: true },
        },
      },
    });

    if (!locationToDelete) {
      throw new NotFoundException(`Location with ID "${id}" not found`);
    }

    if (locationToDelete._count.productsAtLocation > 0) {
      throw new ConflictException(
        `Cannot delete location "${locationToDelete.name}" because it has products assigned to it. Please reassign them first.`,
      );
    }

    try {
      this.logger.log(
        `Deleting location: ${locationToDelete.name} (ID: ${id})`,
      );
      return await this.prisma.location.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error as DbError);
    }
  }

  // --- ProductLocation Management (si se usa la tabla intermedia) ---

  async assignProduct(
    assignDto: AssignProductLocationDto,
  ): Promise<ProductLocation> {
    const { productId, locationId, quantityAtLocation = 0 } = assignDto;

    // Verify product and location exist
    const [product, location] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.location.findUnique({ where: { id: locationId } }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }
    if (!location) {
      throw new NotFoundException(`Location with ID "${locationId}" not found`);
    }

    try {
      return await this.prisma.productLocation.upsert({
        where: {
          productId_locationId: {
            productId,
            locationId,
          },
        },
        update: {
          quantityAtLocation,
        },
        create: {
          productId,
          locationId,
          quantityAtLocation,
        },
      });
    } catch (error) {
      this.handleDbError(error as DbError);
    }
  }

  async updateProductQuantityInLocation(
    productId: string,
    locationId: string,
    updateDto: UpdateProductLocationQuantityDto,
  ): Promise<ProductLocation> {
    const { quantityAtLocation } = updateDto;

    try {
      return await this.prisma.productLocation.update({
        where: {
          productId_locationId: {
            productId,
            locationId,
          },
        },
        data: { quantityAtLocation },
        include: {
          product: true,
          location: true,
        },
      });
    } catch (error) {
      if ((error as DbError).code === 'P2025') {
        throw new NotFoundException(
          `Product ${productId} is not assigned to location ${locationId}. Use the assign endpoint first.`,
        );
      }
      this.handleDbError(error as DbError);
    }
  }

  async removeProductFromLocation(
    productId: string,
    locationId: string,
  ): Promise<any> {
    // --- Opción 1: Borrar de ProductLocation ---
    this.logger.log(
      `Removing Product ${productId} assignment from Location ${locationId}`,
    );
    try {
      // Usar delete con manejo de error si no existe
      await this.prisma.productLocation.delete({
        where: { productId_locationId: { productId, locationId } },
      });
      return {
        message: `Product ${productId} successfully removed from location ${locationId}`,
      };
    } catch (error) {
      if ((error as DbError).code === 'P2025') {
        // No lanzar error si ya no existe, simplemente informar
        this.logger.warn(
          `Product ${productId} was not assigned to location ${locationId}. No action taken.`,
        );
        return {
          message: `Product ${productId} was not assigned to location ${locationId}.`,
        };
      }
      this.handleDbError(error as DbError);
    }

    // --- Opción 2: Quitar ubicación principal de Product ---
    // else {
    //     this.logger.log(`Removing primary Location ${locationId} from Product ${productId}`);
    //     // Verificar que la ubicación actual sea la que se quiere quitar
    //     const product = await this.prisma.product.findUnique({ where: { id: productId } });
    //     if (product?.locationId === locationId) {
    //         return await this.prisma.product.update({
    //             where: { id: productId },
    //             data: { locationId: null }
    //         });
    //     } else {
    //          return { message: `Location ${locationId} was not the primary location for Product ${productId}.` };
    //     }
    // }
  }

  async getProductsInLocation(locationId: string): Promise<any[]> {
    await this.findOne(locationId); // Validate location exists
    this.logger.debug(`Fetching products assigned to location ${locationId}`);

    const locationProducts = await this.prisma.productLocation.findMany({
      where: { locationId: locationId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            currentStock: true,
            isActive: true,
          },
        },
      },
    });

    return locationProducts
      .filter((pl) => pl.product.isActive)
      .map((pl) => ({
        id: pl.product.id,
        name: pl.product.name,
        sku: pl.product.sku,
        currentStock: pl.product.currentStock,
        quantityAtLocation: pl.quantityAtLocation,
      }));
  }

  // Helper para manejar errores de base de datos
  private handleDbError(error: DbError, context?: { name: string }): never {
    if (error.code === 'P2002') {
      const fields = error.meta?.target;
      if (fields?.includes('name') && context?.name) {
        throw new ConflictException(
          `Location with name "${context.name}" already exists.`,
        );
      }
      throw new ConflictException('Unique constraint violation.');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException(
        'The required record (location, product, or assignment) was not found.',
      );
    }
    this.logger.error(
      `Database Error: ${error.message || 'Unknown error'}`,
      error.stack || 'No stack trace available',
    );
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }

  async assignProductToLocation(
    assignDto: AssignProductLocationDto,
  ): Promise<any> {
    // Implement the logic to assign a product to a location
    // Example: Validate the product and location, then create or update the assignment
    const { productId, locationId, quantityAtLocation } = assignDto;

    // Example validation and assignment logic
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!product || !location) {
      throw new Error('Product or Location not found');
    }

    return this.prisma.productLocation.upsert({
      where: { productId_locationId: { productId, locationId } },
      update: { quantityAtLocation },
      create: { productId, locationId, quantityAtLocation },
    });
  }
}
