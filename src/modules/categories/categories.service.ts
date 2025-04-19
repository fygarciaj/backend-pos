import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Category } from '@prisma/client';
import { slugify } from '../../common/utils/slugify';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  CategoryTree,
  CategoryWithSubcategories,
} from './interfaces/category.interface';

interface DbErrorContext {
  name?: string;
  slug?: string;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const {
      name,
      slug: slugInput,
      parentId,
      ...categoryData
    } = createCategoryDto;

    const finalSlug = slugInput ? slugify(slugInput) : slugify(name);

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

    if (parentId) {
      const parentExists = await this.prisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parentExists) {
        throw new NotFoundException(
          `Parent category with ID "${parentId}" not found.`,
        );
      }
    }

    try {
      return await this.prisma.category.create({
        data: {
          ...categoryData,
          name,
          slug: finalSlug,
          ...(parentId && { parentId }),
        },
      });
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
    includeProductsCount?: boolean;
    includeChildren?: boolean;
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
      orderBy: orderBy ?? { name: 'asc' },
      include: {
        _count: includeProductsCount
          ? {
              select: { products: true },
            }
          : undefined,
        subcategories: includeChildren,
      },
    });
  }

  async findOne(id: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          take: 10,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            currentStock: true,
          },
        },
        subcategories: true,
        parentCategory: true,
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
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
        subcategories: true,
        parentCategory: true,
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
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
    // Verify category exists
    const currentCategory = await this.findOne(id);
    if (!currentCategory) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    const { name, slug, parentId, ...categoryData } = updateCategoryDto;
    const dataToUpdate: Prisma.CategoryUpdateInput = { ...categoryData };

    // Validate and prepare name and slug if provided
    if (name || slug) {
      const finalName = name ?? currentCategory.name;
      const finalSlug = slug
        ? slugify(slug)
        : name
          ? slugify(name)
          : currentCategory.slug;

      // Verify if new name or slug exists in ANOTHER category
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          id: { not: id },
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
      dataToUpdate.slug = finalSlug;
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    if (category._count.products > 0 || category._count.subcategories > 0) {
      throw new ConflictException(
        `Cannot delete category "${category.name}" because it has ${category._count.products} products and ${category._count.subcategories} subcategories. Please reassign or delete them first.`,
      );
    }

    try {
      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async getCategoryTree(): Promise<CategoryTree[]> {
    const allCategories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
            subcategories: true,
          },
        },
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // Transform the categories into CategoryTree structure
    const categoriesWithChildren = allCategories.map((cat) => ({
      ...cat,
      children: [],
      subcategories: undefined, // Remove subcategories as we'll use children instead
    })) as CategoryTree[];

    // Filter for root categories and build tree
    return this.buildCategoryTree(
      categoriesWithChildren.filter((cat) => !cat.parentId),
    );
  }

  private buildCategoryTree(categories: CategoryTree[]): CategoryTree[] {
    return categories.map((category) => {
      const cat = category as unknown as CategoryWithSubcategories;
      return {
        ...category,
        subcategories: undefined,
        children: cat.subcategories
          ? this.buildCategoryTree(
              cat.subcategories.map((sub) => ({
                ...sub,
                children: [],
              })) as CategoryTree[],
            )
          : [],
      };
    });
  }

  private handleDbError(error: any, context?: DbErrorContext): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const fields = error.meta?.target as string[];
        let message = 'Unique constraint violation.';
        if (fields?.includes('name') && context?.name) {
          message = `Category with name "${context.name}" already exists.`;
        } else if (fields?.includes('slug') && context?.slug) {
          message = `Category with slug "${context.slug}" already exists.`;
        }
        throw new ConflictException(message);
      }
      if (error.code === 'P2025') {
        // Record not found (e.g., during update/delete)
        throw new NotFoundException('The category record was not found.');
      }
    }
    console.error('Database Error:', error);
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
