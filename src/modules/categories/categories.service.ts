import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service'; // Ajusta ruta
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Prisma, Category } from '@prisma/client';
import { slugify } from '../../common/utils/slugify'; // Necesitaremos una función para generar slugs

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const { name, slug, parentCategoryId, ...categoryData } = createCategoryDto;

    // Generar slug si no se proporciona
    const finalSlug = slug ? slugify(slug) : slugify(name);

    // Verificar si el nombre o slug ya existen
    const existingCategory = await this.prisma.category.findFirst({
      where: { OR: [{ name }, { slug: finalSlug }] },
    });
    if (existingCategory) {
      if (existingCategory.name === name) {
        throw new ConflictException(
          `Category with name "${name}" already exists.`,
        );
      }
      if (existingCategory.slug === finalSlug) {
        throw new ConflictException(
          `Category with slug "${finalSlug}" already exists.`,
        );
      }
    }

    // Verificar si la categoría padre existe (si se proporciona)
    if (parentCategoryId) {
      const parentExists = await this.prisma.category.findUnique({
        where: { id: parentCategoryId },
      });
      if (!parentExists) {
        throw new NotFoundException(
          `Parent category with ID "${parentCategoryId}" not found.`,
        );
      }
    }

    const data: Prisma.CategoryCreateInput = {
      ...categoryData,
      name,
      slug: finalSlug,
      ...(parentCategoryId && {
        parentCategory: { connect: { id: parentCategoryId } },
      }),
    };

    try {
      return await this.prisma.category.create({ data });
    } catch (error) {
      this.handleDbError(error, { name, slug: finalSlug });
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.CategoryWhereUniqueInput;
    where?: Prisma.CategoryWhereInput;
    orderBy?: Prisma.CategoryOrderByWithRelationInput;
    includeProductsCount?: boolean; // Opción para incluir conteo de productos
    includeChildren?: boolean; // Opción para incluir subcategorías
  }): Promise<Category[]> {
    const {
      skip,
      take,
      cursor,
      where,
      orderBy,
      includeProductsCount,
      includeChildren,
    } = params;
    return this.prisma.category.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { order: 'asc', name: 'asc' }, // Orden por defecto
      include: {
        _count: includeProductsCount
          ? { select: { products: true } }
          : undefined,
        childCategories: includeChildren
          ? { include: { _count: { select: { products: true } } } }
          : false, // Incluir hijos si se solicita
        parentCategory: true, // Incluir padre para contexto
      },
    });
  }

  async findOne(id: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: { take: 10, orderBy: { name: 'asc' } }, // Incluir algunos productos de ejemplo
        childCategories: true, // Incluir hijos directos
        parentCategory: true, // Incluir padre
        _count: { select: { products: true, childCategories: true } }, // Contadores
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        products: { take: 10, orderBy: { name: 'asc' } },
        childCategories: true,
        parentCategory: true,
        _count: { select: { products: true, childCategories: true } },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    // Verificar si la categoría existe
    await this.findOne(id);

    const { name, slug, parentCategoryId, ...categoryData } = updateCategoryDto;
    const dataToUpdate: Prisma.CategoryUpdateInput = { ...categoryData };

    // Validar y preparar nombre y slug si se proporcionan
    if (name || slug) {
      const currentCategory = await this.prisma.category.findUnique({
        where: { id },
      });
      const finalName = name ?? currentCategory.name;
      const finalSlug = slug
        ? slugify(slug)
        : name
          ? slugify(name)
          : currentCategory.slug;

      // Verificar si el nuevo nombre o slug ya existen en OTRA categoría
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          id: { not: id }, // Excluir la categoría actual
          OR: [{ name: finalName }, { slug: finalSlug }],
        },
      });
      if (existingCategory) {
        if (existingCategory.name === finalName) {
          throw new ConflictException(
            `Category with name "${finalName}" already exists.`,
          );
        }
        if (existingCategory.slug === finalSlug) {
          throw new ConflictException(
            `Category with slug "${finalSlug}" already exists.`,
          );
        }
      }
      if (name) dataToUpdate.name = name;
      dataToUpdate.slug = finalSlug; // Siempre actualizar slug si nombre o slug cambian
    }

    // Validar y preparar parentCategoryId si se proporciona
    if (parentCategoryId !== undefined) {
      // Permite establecer parent a null
      if (parentCategoryId === id) {
        throw new ConflictException('A category cannot be its own parent.');
      }
      if (parentCategoryId) {
        const parentExists = await this.prisma.category.findUnique({
          where: { id: parentCategoryId },
        });
        if (!parentExists) {
          throw new NotFoundException(
            `Parent category with ID "${parentCategoryId}" not found.`,
          );
        }
        // Opcional: Verificar si se está creando un ciclo (A->B, B->A) - requiere consulta recursiva o lógica adicional
        dataToUpdate.parentCategory = { connect: { id: parentCategoryId } };
      } else {
        dataToUpdate.parentCategory = { disconnect: true }; // Desconectar padre si se pasa null
      }
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      this.handleDbError(error, { name, slug });
    }
  }

  async remove(id: string): Promise<Category> {
    // Verificar si la categoría existe
    const categoryToDelete = await this.findOne(id);

    // Verificar si tiene productos asociados o subcategorías
    const hasProducts = await this.prisma.product.count({
      where: { categoryId: id },
    });
    const hasChildren = await this.prisma.category.count({
      where: { parentCategoryId: id },
    });

    if (hasProducts > 0) {
      throw new ConflictException(
        `Cannot delete category "${categoryToDelete.name}" because it has ${hasProducts} associated products. Please reassign or delete them first.`,
      );
    }
    if (hasChildren > 0) {
      throw new ConflictException(
        `Cannot delete category "${categoryToDelete.name}" because it has ${hasChildren} subcategories. Please reassign or delete them first.`,
      );
    }

    // Si no hay dependencias, proceder a borrar
    try {
      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      // Manejar errores inesperados de borrado
      this.handleDbError(error);
    }
  }

  // Helper para generar árbol de categorías (ejemplo simple)
  async getCategoryTree(): Promise<any[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true }, // Opcional: solo activas
      orderBy: { order: 'asc', name: 'asc' },
      include: {
        _count: { select: { products: true } }, // Contar productos
      },
    });

    const buildTree = (parentId: string | null = null): any[] => {
      return categories
        .filter((category) => category.parentCategoryId === parentId)
        .map((category) => ({
          ...category,
          productCount: category._count.products, // Renombrar para claridad
          children: buildTree(category.id), // Llamada recursiva
        }));
    };

    return buildTree(); // Empezar desde la raíz (parentId = null)
  }

  // Helper para manejar errores de base de datos
  private handleDbError(error: any, context?: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const fields = error.meta?.target as string[];
        let message = 'Unique constraint violation.';
        if (fields?.includes('name') && context?.name)
          message = `Category with name "${context.name}" already exists.`;
        else if (fields?.includes('slug') && context?.slug)
          message = `Category with slug "${context.slug}" already exists.`;
        throw new ConflictException(message);
      }
      if (error.code === 'P2025') {
        // Record not found (e.g., during update/delete)
        throw new NotFoundException('The category record was not found.');
      }
      // Podrías manejar P2003 (Foreign key constraint) aquí si no lo hiciste antes del delete
    }
    console.error('Database Error:', error); // Loguear el error completo
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
