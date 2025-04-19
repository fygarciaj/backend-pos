import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Prisma, Supplier } from '@prisma/client';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    const { name, email, brandIds, ...supplierData } = createSupplierDto;

    // Verificar si el nombre ya existe
    const existingName = await this.prisma.supplier.findUnique({
      where: { name },
    });
    if (existingName) {
      throw new ConflictException(
        `Supplier with name "${name}" already exists.`,
      );
    }
    // Verificar si el email ya existe (si se proporciona)
    if (email) {
      const existingEmail = await this.prisma.supplier.findFirst({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Supplier with email "${email}" already exists.`,
        );
      }
    }

    // Preparar datos para la creación, incluyendo la conexión a marcas si se proporcionan IDs
    const data: Prisma.SupplierCreateInput = {
      ...supplierData,
      name,
      email, // Asegurarse de incluir email si existe
      // Conectar marcas si se proporcionan IDs válidos
      ...(brandIds &&
        brandIds.length > 0 && {
          brands: {
            create: brandIds.map((brandId) => ({
              brand: { connect: { id: brandId } },
            })),
          },
        }),
    };

    try {
      this.logger.log(`Creating supplier: ${name}`);
      // Validar que los brandIds existen antes de crear (dentro de una transacción sería ideal)
      if (brandIds && brandIds.length > 0) {
        const brandsCount = await this.prisma.brand.count({
          where: { id: { in: brandIds } },
        });
        if (brandsCount !== brandIds.length) {
          throw new NotFoundException(
            'One or more provided Brand IDs do not exist.',
          );
        }
      }
      return await this.prisma.supplier.create({
        data,
        include: { brands: { include: { brand: true } } }, // Incluir marcas en la respuesta
      });
    } catch (error) {
      this.handleDbError(error, { name, email });
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.SupplierWhereUniqueInput;
    where?: Prisma.SupplierWhereInput;
    orderBy?: Prisma.SupplierOrderByWithRelationInput;
    includeRelations?: boolean; // Para incluir marcas y/o órdenes de compra
  }): Promise<Supplier[]> {
    const { skip, take, cursor, where, orderBy, includeRelations } = params;
    return this.prisma.supplier.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { name: 'asc' }, // Orden por defecto
      include: {
        _count: includeRelations
          ? { select: { purchaseOrders: true, brands: true } }
          : undefined,
        brands: includeRelations
          ? { select: { brand: { select: { id: true, name: true } } } }
          : false,
        // purchaseOrders: includeRelations ? { take: 5, orderBy: { orderDate: 'desc' } } : false, // Podría ser pesado
      },
    });
  }

  async findOne(
    id: string,
    includeRelations: boolean = true,
  ): Promise<Supplier | null> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: includeRelations
          ? { select: { purchaseOrders: true, brands: true } }
          : undefined,
        brands: includeRelations ? { include: { brand: true } } : false, // Incluir detalles de marca
        purchaseOrders: includeRelations
          ? { take: 10, orderBy: { orderDate: 'desc' } }
          : false, // Incluir últimas órdenes
      },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    }
    return supplier;
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    // Verificar si el proveedor existe
    await this.findOne(id, false); // No necesitamos relaciones aquí

    const { name, email, brandIds, ...supplierData } = updateSupplierDto;
    const dataToUpdate: Prisma.SupplierUpdateInput = { ...supplierData };

    // Validar nombre único si se cambia
    if (name) {
      const existingName = await this.prisma.supplier.findFirst({
        where: { name, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException(
          `Supplier with name "${name}" already exists.`,
        );
      }
      dataToUpdate.name = name;
    }
    // Validar email único si se cambia
    if (email) {
      const existingEmail = await this.prisma.supplier.findFirst({
        where: { email, id: { not: id } },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Supplier with email "${email}" already exists.`,
        );
      }
      dataToUpdate.email = email;
    } else if (email === null) {
      // Permitir borrar email
      dataToUpdate.email = null;
    }

    // Manejar actualización de Marcas (ejemplo: reemplazar todas las relaciones)
    // Una lógica más compleja podría añadir/quitar marcas específicas
    if (brandIds !== undefined) {
      // Validar que los nuevos brandIds existen
      if (brandIds.length > 0) {
        const brandsCount = await this.prisma.brand.count({
          where: { id: { in: brandIds } },
        });
        if (brandsCount !== brandIds.length) {
          throw new NotFoundException(
            'One or more provided Brand IDs do not exist for update.',
          );
        }
      }
      // Usar transacción para borrar antiguas y crear nuevas relaciones
      return this.prisma.$transaction(async (tx) => {
        // 1. Borrar relaciones existentes en SupplierBrand
        await tx.supplierBrand.deleteMany({ where: { supplierId: id } });
        // 2. Actualizar datos del proveedor y crear nuevas relaciones
        const updatedSupplier = await tx.supplier.update({
          where: { id },
          data: {
            ...dataToUpdate,
            brands: {
              create: brandIds.map((brandId) => ({
                brand: { connect: { id: brandId } },
              })),
            },
          },
          include: { brands: { include: { brand: true } } }, // Incluir en respuesta
        });
        return updatedSupplier;
      });
    } else {
      // Actualizar sin tocar las marcas si brandIds no está en el DTO
      try {
        return await this.prisma.supplier.update({
          where: { id },
          data: dataToUpdate,
          include: { brands: { include: { brand: true } } }, // Incluir en respuesta
        });
      } catch (error) {
        this.handleDbError(error, { name, email });
      }
    }
  }

  async remove(id: string): Promise<Supplier> {
    const supplierToDelete = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    if (!supplierToDelete) {
      throw new NotFoundException(`Supplier with ID "${id}" not found`);
    }

    if (supplierToDelete._count.purchaseOrders > 0) {
      throw new ConflictException(
        `Cannot delete supplier "${supplierToDelete.name}" because they have ${supplierToDelete._count.purchaseOrders} associated purchase orders. Please reassign or delete them first.`,
      );
    }

    try {
      this.logger.log(
        `Deleting supplier: ${supplierToDelete.name} (ID: ${id})`,
      );
      return await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
  }

  // Updated handleDbError to ensure type safety
  private handleDbError(
    error: unknown,
    context?: { name?: string; email?: string },
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const fields = error.meta?.target as string[];
        let message = 'Unique constraint violation.';
        if (fields?.includes('name') && context?.name)
          message = `Supplier with name "${context.name}" already exists.`;
        else if (fields?.includes('email') && context?.email)
          message = `Supplier with email "${context.email}" already exists.`;
        throw new ConflictException(message);
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('The supplier record was not found.');
      }
    }
    if (error instanceof Error) {
      this.logger.error(`Database Error: ${error.message}`, error.stack);
    }
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
