import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignProductLocationDto } from './dto/assign-product-location.dto';
import { UpdateProductLocationQuantityDto } from './dto/update-product-location-quantity.dto';
import { Prisma, Location, ProductLocation, Product } from '@prisma/client';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- Location CRUD ---

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const { name, ...locationData } = createLocationDto;

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
      this.handleDbError(error, { name });
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
        _count: { select: { products: true, productLocations: true } }, // Contar productos asociados
      },
    });
  }

  async findOne(id: string): Promise<Location | null> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        // Incluir productos cuya ubicación principal es esta
        products: { take: 10, select: { id: true, name: true, sku: true } },
        // Incluir productos específicos en esta ubicación (si se usa ProductLocation)
        productLocations: {
          take: 10,
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        _count: true,
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
    }

    try {
      this.logger.log(`Updating location ID: ${id}`);
      return await this.prisma.location.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      this.handleDbError(error, { name });
    }
  }

  async remove(id: string): Promise<Location> {
    const locationToDelete = await this.findOne(id); // Check existence and relations

    // Verificar si hay productos asignados (como ubicación principal o en ProductLocation)
    if (
      locationToDelete._count.products > 0 ||
      locationToDelete._count.productLocations > 0
    ) {
      throw new ConflictException(
        `Cannot delete location "${locationToDelete.name}" because it has associated products. Please reassign them first.`,
      );
    }

    try {
      this.logger.log(
        `Deleting location: ${locationToDelete.name} (ID: ${id})`,
      );
      return await this.prisma.location.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
  }

  // --- ProductLocation Management (si se usa la tabla intermedia) ---

  async assignProductToLocation(
    assignDto: AssignProductLocationDto,
  ): Promise<ProductLocation | Product> {
    const { productId, locationId, quantityAtLocation } = assignDto;

    // Validar que producto y ubicación existen
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!product)
      throw new NotFoundException(`Product with ID "${productId}" not found.`);
    if (!location)
      throw new NotFoundException(
        `Location with ID "${locationId}" not found.`,
      );

    // --- Opción 1: Usar la tabla intermedia ProductLocation ---
    if (quantityAtLocation !== undefined) {
      this.logger.log(
        `Assigning/Updating Product ${productId} to Location ${locationId} with quantity ${quantityAtLocation}`,
      );
      try {
        // Usar upsert para crear o actualizar la entrada en ProductLocation
        return await this.prisma.productLocation.upsert({
          where: { productId_locationId: { productId, locationId } },
          update: { quantityAtLocation },
          create: { productId, locationId, quantityAtLocation },
          include: { product: true, location: true }, // Incluir relaciones en la respuesta
        });
      } catch (error) {
        this.handleDbError(error);
      }
    }
    // --- Opción 2: Usar el campo locationId en Product (ubicación principal) ---
    else {
      this.logger.log(
        `Setting Location ${locationId} as primary for Product ${productId}`,
      );
      try {
        return await this.prisma.product.update({
          where: { id: productId },
          data: { locationId: locationId },
          include: { location: true }, // Incluir la ubicación en la respuesta
        });
      } catch (error) {
        this.handleDbError(error);
      }
    }
  }

  async updateProductQuantityInLocation(
    productId: string,
    locationId: string,
    updateDto: UpdateProductLocationQuantityDto,
  ): Promise<ProductLocation> {
    const { quantityAtLocation } = updateDto;
    this.logger.log(
      `Updating quantity for Product ${productId} in Location ${locationId} to ${quantityAtLocation}`,
    );

    try {
      // Usar update con manejo de error si no existe la combinación
      return await this.prisma.productLocation.update({
        where: { productId_locationId: { productId, locationId } },
        data: { quantityAtLocation },
        include: { product: true, location: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Product ${productId} is not assigned to location ${locationId}. Use the assign endpoint first.`,
        );
      }
      this.handleDbError(error);
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // No lanzar error si ya no existe, simplemente informar
        this.logger.warn(
          `Product ${productId} was not assigned to location ${locationId}. No action taken.`,
        );
        return {
          message: `Product ${productId} was not assigned to location ${locationId}.`,
        };
      }
      this.handleDbError(error);
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
    await this.findOne(locationId); // Validar que la ubicación existe
    this.logger.debug(`Fetching products assigned to location ${locationId}`);

    // Combina productos con ubicación principal y los de ProductLocation
    const primaryLocationProducts = await this.prisma.product.findMany({
      where: { locationId: locationId, isActive: true },
      select: { id: true, name: true, sku: true, currentStock: true }, // currentStock es el total
    });

    const specificLocationProducts = await this.prisma.productLocation.findMany(
      {
        where: { locationId: locationId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, isActive: true },
          },
        },
      },
    );

    // Formatear y combinar resultados (evitando duplicados si un producto está en ambos)
    const productMap = new Map();

    primaryLocationProducts.forEach((p) => {
      productMap.set(p.id, {
        ...p,
        quantityAtLocation: null,
        source: 'primary',
      });
    });

    specificLocationProducts.forEach((pl) => {
      if (pl.product.isActive) {
        // Solo incluir si el producto está activo
        const existing = productMap.get(pl.productId);
        if (existing) {
          existing.quantityAtLocation = pl.quantityAtLocation;
          existing.source = 'both'; // O actualizar como prefieras
        } else {
          productMap.set(pl.productId, {
            id: pl.productId,
            name: pl.product.name,
            sku: pl.product.sku,
            quantityAtLocation: pl.quantityAtLocation,
            source: 'specific',
          });
        }
      }
    });

    return Array.from(productMap.values());
  }

  // Helper para manejar errores de base de datos
  private handleDbError(error: any, context?: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const fields = error.meta?.target as string[];
        if (fields?.includes('name') && context?.name) {
          throw new ConflictException(
            `Location with name "${context.name}" already exists.`,
          );
        }
        // Podría haber otros unique constraints (ej: productId_locationId en ProductLocation)
        throw new ConflictException('Unique constraint violation.');
      }
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundException(
          'The required record (location, product, or assignment) was not found.',
        );
      }
      // P2003 (Foreign key constraint) se maneja con las verificaciones previas
    }
    this.logger.error(`Database Error: ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
