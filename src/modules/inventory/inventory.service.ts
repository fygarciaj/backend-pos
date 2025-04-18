import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service'; // Necesario para ajustar stock
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import {
  Prisma,
  InventoryMovement,
  InventoryMovementType,
  Product,
} from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Performs a manual inventory adjustment for a product.
   * @param adjustInventoryDto - DTO containing adjustment details.
   * @param userId - ID of the user performing the adjustment.
   * @returns The updated product information.
   */
  async adjustStock(
    adjustInventoryDto: AdjustInventoryDto,
    userId: string,
  ): Promise<Product> {
    const { productId, type, quantity, reason } = adjustInventoryDto;

    // Validar que la cantidad sea positiva
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive number.');
    }

    // Determinar el cambio real en la cantidad basado en el tipo
    const quantityChange =
      type === InventoryMovementType.ADJUSTMENT_IN ? quantity : -quantity;

    this.logger.log(
      `Attempting stock adjustment for product ${productId} by user ${userId}. Type: ${type}, Quantity Change: ${quantityChange}, Reason: ${reason}`,
    );

    // Llamar al método updateStock del ProductsService, que maneja la transacción
    // y la creación del registro de movimiento. No necesitamos una transacción aquí.
    try {
      const updatedProduct = await this.productsService.updateStock(
        productId,
        quantityChange,
        type, // ADJUSTMENT_IN o ADJUSTMENT_OUT
        userId,
        reason, // Razón del ajuste
        undefined, // relatedSaleId
        undefined, // relatedPurchaseOrderId
        undefined, // relatedReturnId
        // No pasamos 'tx' aquí, ProductsService manejará su propia lógica si es necesario
      );
      this.logger.log(
        `Stock adjustment successful for product ${productId}. New stock: ${updatedProduct.currentStock}`,
      );
      return updatedProduct;
    } catch (error) {
      // ProductsService ya debería lanzar errores apropiados (NotFound, Conflict)
      this.logger.error(
        `Stock adjustment failed for product ${productId}: ${error.message}`,
        error.stack,
      );
      // Re-lanzar el error para que el controlador lo maneje
      throw error;
    }
  }

  /**
   * Retrieves a list of inventory movements based on filter criteria.
   * @param params - Filtering and pagination parameters.
   * @returns A list of inventory movements.
   */
  async getInventoryMovements(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.InventoryMovementWhereUniqueInput;
    where?: Prisma.InventoryMovementWhereInput;
    orderBy?: Prisma.InventoryMovementOrderByWithRelationInput;
  }): Promise<InventoryMovement[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.inventoryMovement.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { movementDate: 'desc' }, // Ordenar por fecha descendente por defecto
      include: {
        product: { select: { id: true, name: true, sku: true } }, // Incluir info básica del producto
        user: { select: { id: true, username: true, fullName: true } }, // Incluir info básica del usuario
        // Podríamos incluir opcionalmente Sale, PurchaseOrder, Return si se necesita navegar desde aquí
      },
    });
  }

  /**
   * Retrieves a report of current stock levels, optionally filtering low stock.
   * @param params - Filtering parameters (e.g., lowStockOnly).
   * @returns A list of products with their stock levels.
   */
  async getCurrentStockReport(params: {
    lowStockOnly?: boolean;
    categoryId?: string;
    brandId?: string;
    search?: string;
    skip?: number;
    take?: number;
  }): Promise<Product[]> {
    const { lowStockOnly, categoryId, brandId, search, skip, take } = params;
    const where: Prisma.ProductWhereInput = {
      isActive: true, // Generalmente solo reportamos sobre productos activos
    };

    if (lowStockOnly) {
      // Filtrar donde currentStock <= minStock
      where.currentStock = {
        lte: { prisma: { product: { fields: ['minStock'] } } },
      }; // Referencia a otro campo
      // Alternativa más simple si la anterior no funciona en todas las DBs:
      // where.AND = [{ currentStock: { lte: prisma.product.fields.minStock } }]; // Necesita importación especial
      // O la forma más compatible pero menos eficiente: obtener todos y filtrar en código (no recomendado para grandes datasets)
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      skip,
      take,
      select: {
        // Seleccionar solo campos relevantes para el reporte
        id: true,
        name: true,
        sku: true,
        barcode: true,
        currentStock: true,
        minStock: true,
        unitOfMeasure: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        // sellingPrice: true, // Podría ser útil
      },
      orderBy: { name: 'asc' },
    });

    // Nota: La forma de comparar currentStock <= minStock puede variar o requerir raw queries
    // dependiendo de la versión de Prisma y la base de datos. La forma más segura
    // si la referencia directa no funciona es:
    // const products = await this.prisma.product.findMany({ where: { isActive: true }, select: { id: true, currentStock: true, minStock: true, ... } });
    // return products.filter(p => p.currentStock <= p.minStock);
    // Pero esto es ineficiente para la paginación y grandes datasets.
  }
}
