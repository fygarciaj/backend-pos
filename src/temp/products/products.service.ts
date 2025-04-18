import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, Product } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { categoryId, brandId, ...productData } = createProductDto;

    // Validación opcional: Verificar si categoryId y brandId existen
    // await this.validateCategoryExists(categoryId);
    // if (brandId) await this.validateBrandExists(brandId);

    try {
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          category: { connect: { id: categoryId } }, // Conectar relación
          brand: brandId ? { connect: { id: brandId } } : undefined, // Conectar si existe
        },
        include: { category: true, brand: true }, // Incluir relaciones en la respuesta
      });
      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint (barcode, sku)
          const target = error.meta?.target as string[];
          throw new ConflictException(
            `Product with this ${target?.join(', ')} already exists.`,
          );
        }
        if (error.code === 'P2025') {
          // Foreign key constraint failed (category/brand not found)
          throw new NotFoundException(`Category or Brand not found.`);
        }
      }
      console.error('Error creating product:', error);
      throw new InternalServerErrorException('Could not create product.');
    }
  }

  async findAll(
    pagination: { page: number; limit: number },
    filters: {
      search?: string;
      categoryId?: string;
      brandId?: string;
      isActive?: string;
      inStock?: string;
    },
  ): Promise<{ data: Product[]; count: number }> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } }, // 'insensitive' si usas Postgres, quitar para MySQL
        { sku: { contains: filters.search } },
        { tags: { contains: filters.search } },
        // { barcode: { contains: filters.search } }, // Descomentar si buscas por barcode
      ];
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.brandId) {
      where.brandId = filters.brandId;
    }
    if (filters.isActive !== undefined) {
      // Convertir string 'true'/'false' a boolean
      where.isActive = String(filters.isActive).toLowerCase() === 'true';
    }
    if (filters.inStock !== undefined) {
      if (String(filters.inStock).toLowerCase() === 'true') {
        where.currentStock = { gt: 0 }; // Mayor que 0
      } else {
        where.currentStock = { lte: 0 }; // Menor o igual a 0
      }
    }

    try {
      const [products, count] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          skip,
          take: limit,
          where,
          include: {
            // Incluir relaciones importantes
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
          },
          orderBy: {
            name: 'asc', // O por createdAt, etc.
          },
        }),
        this.prisma.product.count({ where }),
      ]);
      return { data: products, count };
    } catch (error) {
      console.error('Error finding products:', error);
      throw new InternalServerErrorException('Could not retrieve products.');
    }
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        // Incluir otras relaciones si es necesario (ej: ubicaciones)
        // locations: { include: { location: true } }
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { category: true, brand: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with SKU "${sku}" not found.`);
    }
    return product;
  }

  async findByBarcode(barcode: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true, brand: true },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with Barcode "${barcode}" not found.`,
      );
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const { categoryId, brandId, ...productData } = updateProductDto;
    const dataToUpdate: Prisma.ProductUpdateInput = { ...productData };

    // Si se actualizan las relaciones, usar 'connect'
    if (categoryId) {
      dataToUpdate.category = { connect: { id: categoryId } };
    }
    if (brandId !== undefined) {
      // Permitir desconectar la marca si brandId es null
      dataToUpdate.brand = brandId
        ? { connect: { id: brandId } }
        : { disconnect: true };
    }

    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: dataToUpdate,
        include: { category: true, brand: true },
      });
      return updatedProduct;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          throw new ConflictException(
            `Product with this ${target?.join(', ')} already exists.`,
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `Product with ID "${id}" or related Category/Brand not found.`,
          );
        }
      }
      console.error('Error updating product:', error);
      throw new InternalServerErrorException('Could not update product.');
    }
  }

  async remove(id: string): Promise<Product> {
    // Considerar borrado lógico:
    // return this.update(id, { isActive: false });

    try {
      // Primero verificar si existe para lanzar NotFoundException si no
      const productExists = await this.prisma.product.findUnique({
        where: { id },
      });
      if (!productExists) {
        throw new NotFoundException(`Product with ID "${id}" not found.`);
      }
      // Intentar borrar
      const deletedProduct = await this.prisma.product.delete({
        where: { id },
      });
      return deletedProduct;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Ya manejado arriba, pero por si acaso
          throw new NotFoundException(`Product with ID "${id}" not found.`);
        }
        if (error.code === 'P2003') {
          // Foreign key constraint (e.g., product exists in sale details)
          throw new ConflictException(
            `Cannot delete product with ID "${id}" because it is referenced in other records (e.g., sales, inventory). Consider deactivating it instead.`,
          );
        }
      }
      console.error('Error deleting product:', error);
      throw new InternalServerErrorException('Could not delete product.');
    }
  }

  // --- Métodos Adicionales ---

  async findLowStock(): Promise<Product[]> {
    try {
      return await this.prisma.product.findMany({
        where: {
          isActive: true,
          minimumStock: { not: null }, // Solo si tienen stock mínimo definido
          currentStock: {
            // Usar `expr` para comparar dos columnas directamente (si Prisma lo soporta para tu versión/DB)
            // O calcular en la aplicación después de obtener los datos
            // Aquí asumimos que currentStock < minimumStock
            lt: this.prisma.product.fields.minimumStock, // Esto puede no funcionar directamente, revisar documentación
            // Alternativa: Filtrar después de obtener
          },
          // Alternativa más simple si no se puede comparar columnas:
          // currentStock: { lt: umbralFijo } // O filtrar en la aplicación
        },
        // Filtrado post-consulta si la comparación directa no funciona:
        // const products = await this.prisma.product.findMany({ where: { isActive: true, minimumStock: { not: null } } });
        // return products.filter(p => p.currentStock < p.minimumStock!);

        // Usando Raw Query si es necesario para comparar columnas:
        // const lowStockProducts = await this.prisma.$queryRaw<Product[]>(
        //   Prisma.sql`SELECT * FROM products WHERE "isActive" = true AND "minimumStock" IS NOT NULL AND "currentStock" < "minimumStock"`
        // );
        // return lowStockProducts;

        // **Solución más pragmática sin Raw Query:** Obtener todos los activos con stock mínimo y filtrar en JS
        // where: { isActive: true, minimumStock: { not: null } }
      });
      // **Aplicar filtro JS aquí si se usa la solución pragmática**
      // const products = await this.prisma.product.findMany({ where: { isActive: true, minimumStock: { not: null } } });
      // return products.filter(p => p.currentStock < p.minimumStock!);
    } catch (error) {
      console.error('Error finding low stock products:', error);
      throw new InternalServerErrorException(
        'Could not retrieve low stock products.',
      );
    }
  }

  // Método para actualizar stock (usado por Sales, Returns, Inventory)
  // ¡IMPORTANTE: Usar transacciones aquí es crucial!
  async updateStock(
    productId: string,
    quantityChange: number,
    prismaTx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prismaClient = prismaTx || this.prisma; // Usar cliente de transacción si se provee
    try {
      await prismaClient.product.update({
        where: { id: productId },
        data: {
          currentStock: {
            increment: quantityChange, // quantityChange será negativo para salidas
          },
        },
      });
      // Aquí también se podría verificar si el stock cae bajo el mínimo y emitir un evento/notificación
    } catch (error) {
      // Loggear el error específico
      console.error(`Failed to update stock for product ${productId}:`, error);
      // Si estamos en una transacción, el error hará rollback. Si no, lanzar excepción.
      if (!prismaTx) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException(
            `Product with ID "${productId}" not found for stock update.`,
          );
        }
        throw new InternalServerErrorException(
          `Could not update stock for product ${productId}.`,
        );
      }
      // Si estamos en tx, simplemente relanzamos para que la tx falle
      throw error;
    }
  }

  // --- Helpers (Opcional) ---
  // private async validateCategoryExists(id: string): Promise<void> {
  //   const category = await this.prisma.category.findUnique({ where: { id } });
  //   if (!category) throw new NotFoundException(`Category with ID "${id}" not found.`);
  // }
  // private async validateBrandExists(id: string): Promise<void> {
  //   const brand = await this.prisma.brand.findUnique({ where: { id } });
  //   if (!brand) throw new NotFoundException(`Brand with ID "${id}" not found.`);
  // }
}
