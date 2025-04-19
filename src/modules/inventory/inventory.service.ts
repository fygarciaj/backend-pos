import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service'; // Necesario para ajustar stock
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import {
  Prisma,
  InventoryMovement,
  MovementType,
  Product,
} from '@prisma/client';
// Importar Prisma para usar tipos y $queryRaw
import { Prisma as PrismaTypes } from '@prisma/client';

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
      type === MovementType.POSITIVE_ADJUSTMENT ? quantity : -quantity;

    this.logger.log(
      `Attempting stock adjustment for product ${productId} by user ${userId}. Type: ${type}, Quantity Change: ${quantityChange}, Reason: ${reason}`,
    );

    // Llamar al método updateStock del ProductsService, que maneja la transacción
    // y la creación del registro de movimiento. No necesitamos una transacción aquí.
    try {
      const updatedProduct = await this.productsService.updateStock(
        productId,
        quantityChange,
        type, // MovementType
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
      orderBy: orderBy ?? { timestamp: 'desc' }, // Cambiar movementDate a timestamp
      include: {
        product: { select: { id: true, name: true, sku: true } }, // Incluir info básica del producto
        user: { select: { id: true, username: true, fullName: true } }, // Incluir info básica del usuario
      },
    });
  }

  /**
   * Retrieves a report of current stock levels, optionally filtering low stock.
   * Uses $queryRaw for efficient low stock filtering.
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
    // Definir una interfaz para el tipo de resultado esperado de $queryRaw
  }): Promise<any[]> {
    // El tipo de retorno será un array de objetos crudos o mapeados
    const {
      lowStockOnly = false, // Default a false
      categoryId,
      brandId,
      search,
      skip = 0, // Default a 0
      take = 50, // Default a 50
    } = params;

    const conditions: string[] = ['p."isActive" = TRUE']; // Siempre filtrar por activos
    const queryParams: any[] = [];

    if (lowStockOnly) {
      conditions.push('p."currentStock" <= p."minimumStock"'); // Cambiar minStock a minimumStock
    }
    if (categoryId) {
      queryParams.push(categoryId);
      conditions.push(`p."categoryId" = $${queryParams.length}`);
    }
    if (brandId) {
      queryParams.push(brandId);
      conditions.push(`p."brandId" = $${queryParams.length}`);
    }
    if (search) {
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern);
      const searchIndex = queryParams.length;
      // Asumiendo que la base de datos soporta ILIKE para case-insensitive
      // Ajustar a LIKE si es necesario o si la colación ya es case-insensitive
      conditions.push(
        `(p."name" ILIKE $${searchIndex} OR p."sku" ILIKE $${searchIndex} OR p."barcode" ILIKE $${searchIndex})`,
      );
    }

    // Construir la cláusula WHERE
    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Construir la consulta SQL cruda
    // Seleccionamos los campos necesarios y unimos con Category y Brand
    // Usamos alias para claridad y evitar colisiones de nombres
    const rawQuery = PrismaTypes.sql`
        SELECT
            p.id,
            p.name,
            p.sku,
            p.barcode,
            p."currentStock",
            p."minimumStock",
            p."unitOfMeasure",
            c.id as "categoryId",
            c.name as "categoryName",
            b.id as "brandId",
            b.name as "brandName"
        FROM "Product" p
        LEFT JOIN "Category" c ON p."categoryId" = c.id
        LEFT JOIN "Brand" b ON p."brandId" = b.id
        ${PrismaTypes.raw(whereClause)} -- Inyectar cláusula WHERE construida
        ORDER BY p.name ASC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    // Añadir parámetros de paginación al array
    queryParams.push(take);
    queryParams.push(skip);

    this.logger.debug(
      `Executing raw query for stock report: ${rawQuery} with params: ${JSON.stringify(queryParams)}`,
    );

    try {
      const result: any[] = await this.prisma.$queryRaw(
        rawQuery,
        ...queryParams,
      );

      // Mapear el resultado crudo a una estructura más amigable si es necesario
      // (similar al 'select' original)
      return result.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        currentStock: row.currentStock,
        minimumStock: row.minimumStock,
        unitOfMeasure: row.unitOfMeasure,
        category: {
          id: row.categoryId,
          name: row.categoryName,
        },
        brand: {
          id: row.brandId,
          name: row.brandName,
        },
      }));
    } catch (error) {
      this.logger.error(
        `Error executing raw query for stock report: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to generate current stock report: ${error.message}`,
      );
    }
  }
}
