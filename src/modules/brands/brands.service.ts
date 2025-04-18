import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service'; // Ajusta ruta
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma, Brand } from '@prisma/client';
import { slugify } from '../../common/utils/slugify'; // Reutilizamos la utilidad

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    const { name, slug, ...brandData } = createBrandDto;

    // Generar slug si no se proporciona
    const finalSlug = slug ? slugify(slug) : slugify(name);

    // Verificar si el nombre o slug ya existen
    const existingBrand = await this.prisma.brand.findFirst({
      where: { OR: [{ name }, { slug: finalSlug }] },
    });
    if (existingBrand) {
      if (existingBrand.name === name) {
        throw new ConflictException(
          `Brand with name "${name}" already exists.`,
        );
      }
      if (existingBrand.slug === finalSlug) {
        throw new ConflictException(
          `Brand with slug "${finalSlug}" already exists.`,
        );
      }
    }

    const data: Prisma.BrandCreateInput = {
      ...brandData,
      name,
      slug: finalSlug,
    };

    try {
      return await this.prisma.brand.create({ data });
    } catch (error) {
      this.handleDbError(error, { name, slug: finalSlug });
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.BrandWhereUniqueInput;
    where?: Prisma.BrandWhereInput;
    orderBy?: Prisma.BrandOrderByWithRelationInput;
    includeProductsCount?: boolean; // Opción para incluir conteo de productos
  }): Promise<Brand[]> {
    const { skip, take, cursor, where, orderBy, includeProductsCount } = params;
    return this.prisma.brand.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { order: 'asc', name: 'asc' }, // Orden por defecto
      include: {
        _count: includeProductsCount
          ? { select: { products: true } }
          : undefined,
        // Podríamos incluir 'suppliers' si fuera necesario, pero puede ser pesado
      },
    });
  }

  async findOne(id: string): Promise<Brand | null> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        products: { take: 10, orderBy: { name: 'asc' } }, // Incluir algunos productos
        _count: { select: { products: true } }, // Contar productos
        // suppliers: { include: { supplier: true } }, // Incluir proveedores si es necesario
      },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }
    return brand;
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        products: { take: 10, orderBy: { name: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with slug "${slug}" not found`);
    }
    return brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    // Verificar si la marca existe
    await this.findOne(id);

    const { name, slug, ...brandData } = updateBrandDto;
    const dataToUpdate: Prisma.BrandUpdateInput = { ...brandData };

    // Validar y preparar nombre y slug si se proporcionan
    if (name || slug) {
      const currentBrand = await this.prisma.brand.findUnique({
        where: { id },
      });
      const finalName = name ?? currentBrand.name;
      const finalSlug = slug
        ? slugify(slug)
        : name
          ? slugify(name)
          : currentBrand.slug;

      // Verificar si el nuevo nombre o slug ya existen en OTRA marca
      const existingBrand = await this.prisma.brand.findFirst({
        where: {
          id: { not: id }, // Excluir la marca actual
          OR: [{ name: finalName }, { slug: finalSlug }],
        },
      });
      if (existingBrand) {
        if (existingBrand.name === finalName) {
          throw new ConflictException(
            `Brand with name "${finalName}" already exists.`,
          );
        }
        if (existingBrand.slug === finalSlug) {
          throw new ConflictException(
            `Brand with slug "${finalSlug}" already exists.`,
          );
        }
      }
      if (name) dataToUpdate.name = name;
      dataToUpdate.slug = finalSlug; // Siempre actualizar slug si nombre o slug cambian
    }

    try {
      return await this.prisma.brand.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      this.handleDbError(error, { name, slug });
    }
  }

  async remove(id: string): Promise<Brand> {
    // Verificar si la marca existe
    const brandToDelete = await this.findOne(id);

    // Verificar si tiene productos asociados
    // Nota: La relación con SupplierBrand (muchos-a-muchos) se borraría automáticamente si se borra la marca,
    // pero es bueno verificar si hay productos primero.
    const hasProducts = await this.prisma.product.count({
      where: { brandId: id },
    });

    if (hasProducts > 0) {
      throw new ConflictException(
        `Cannot delete brand "${brandToDelete.name}" because it has ${hasProducts} associated products. Please reassign or delete them first.`,
      );
    }

    // Si no hay dependencias de productos, proceder a borrar
    // Prisma manejará el borrado en cascada de SupplierBrand si está configurado así (por defecto lo hace)
    try {
      return await this.prisma.brand.delete({
        where: { id },
      });
    } catch (error) {
      // Manejar errores inesperados de borrado
      this.handleDbError(error);
    }
  }

  // Helper para manejar errores de base de datos (similar al de CategoriesService)
  private handleDbError(error: any, context?: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const fields = error.meta?.target as string[];
        let message = 'Unique constraint violation.';
        if (fields?.includes('name') && context?.name)
          message = `Brand with name "${context.name}" already exists.`;
        else if (fields?.includes('slug') && context?.slug)
          message = `Brand with slug "${context.slug}" already exists.`;
        throw new ConflictException(message);
      }
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundException('The brand record was not found.');
      }
      // P2003 (Foreign key constraint) se maneja con la verificación de productos antes de borrar
    }
    console.error('Database Error:', error);
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
