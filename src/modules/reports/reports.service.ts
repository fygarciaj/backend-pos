import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Prisma, SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un resumen de ventas dentro de un período de tiempo.
   */
  async getSalesSummary(query: ReportQueryDto): Promise<any> {
    this.logger.debug(
      `Generating Sales Summary report with query: ${JSON.stringify(query)}`,
    );

    const where: Prisma.SaleWhereInput = {
      // Filtrar por estado (generalmente solo completadas para resúmenes financieros)
      status: query.saleStatus ?? SaleStatus.COMPLETED,
    };
    if (query.startDate || query.endDate) {
      where.saleDate = {};
      if (query.startDate) where.saleDate.gte = new Date(query.startDate);
      if (query.endDate) where.saleDate.lte = new Date(query.endDate);
    }
    if (query.userId) where.userId = query.userId;
    if (query.customerId) where.customerId = query.customerId;
    // No filtramos por producto/categoría/marca aquí, eso es para otro reporte

    try {
      const result = await this.prisma.sale.aggregate({
        where,
        _count: {
          id: true, // Contar número de ventas
        },
        _sum: {
          subtotal: true,
          taxes: true,
          total: true,
          discountAmount: true, // Sumar descuentos aplicados
        },
        _avg: {
          total: true, // Valor promedio de venta
        },
      });

      // Formatear la respuesta para mayor claridad
      return {
        period: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        filtersApplied: {
          status: where.status,
          userId: query.userId,
          customerId: query.customerId,
        },
        summary: {
          numberOfSales: result._count.id ?? 0,
          totalSubtotal: result._sum.subtotal ?? new Decimal(0),
          totalTaxes: result._sum.taxes ?? new Decimal(0),
          totalDiscounts: result._sum.discountAmount ?? new Decimal(0), // Asumiendo discountAmount es el valor fijo
          // TODO: Calcular descuento total si se usa discountPercent
          totalRevenue: result._sum.total ?? new Decimal(0),
          averageSaleValue: result._avg.total ?? new Decimal(0),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating sales summary: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to generate sales summary: ${error.message}`);
    }
  }

  /**
   * Genera un reporte de ventas agrupado por producto.
   */
  async getSalesByProduct(query: ReportQueryDto): Promise<any[]> {
    this.logger.debug(
      `Generating Sales by Product report with query: ${JSON.stringify(query)}`,
    );

    const saleWhere: Prisma.SaleWhereInput = {
      status: query.saleStatus ?? SaleStatus.COMPLETED,
    };
    if (query.startDate || query.endDate) {
      saleWhere.saleDate = {};
      if (query.startDate) saleWhere.saleDate.gte = new Date(query.startDate);
      if (query.endDate) saleWhere.saleDate.lte = new Date(query.endDate);
    }
    if (query.userId) saleWhere.userId = query.userId;
    // Otros filtros de Sale si son necesarios

    const productWhere: Prisma.ProductWhereInput = {};
    if (query.categoryId) productWhere.categoryId = query.categoryId;
    if (query.brandId) productWhere.brandId = query.brandId;
    // No filtramos por productId aquí, ya que agrupamos por él

    try {
      const result = await this.prisma.saleDetail.groupBy({
        by: ['productId'],
        where: {
          sale: saleWhere, // Aplicar filtros de la venta
          product: productWhere, // Aplicar filtros del producto
          // Filtrar por productId si se especificó en el query general
          ...(query.productId && { productId: query.productId }),
        },
        _sum: {
          quantity: true, // Suma de cantidades vendidas
          total: true, // Suma del total del ítem (después de descuentos/impuestos de ítem si los hubiera)
          subtotal: true, // Suma del subtotal del ítem
        },
        _count: {
          id: true, // Contar cuántas veces aparece el producto en detalles de venta
        },
        orderBy: {
          _sum: {
            quantity: 'desc', // Ordenar por cantidad vendida descendente por defecto
          },
        },
      });

      // Enriquecer el resultado con información del producto
      const productIds = result.map((item) => item.productId);
      const productsInfo = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true, sellingPrice: true }, // Campos necesarios
      });
      const productsMap = new Map(productsInfo.map((p) => [p.id, p]));

      return result.map((item) => ({
        product: productsMap.get(item.productId) || {
          id: item.productId,
          name: 'Unknown Product',
        },
        totalQuantitySold: item._sum.quantity ?? 0,
        totalRevenue: item._sum.total ?? new Decimal(0),
        totalSubtotal: item._sum.subtotal ?? new Decimal(0),
        numberOfSalesEntries: item._count.id ?? 0,
      }));
    } catch (error) {
      this.logger.error(
        `Error generating sales by product report: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to generate sales by product report: ${error.message}`,
      );
    }
  }

  /**
   * Calcula el valor total del inventario actual (basado en precio de costo).
   */
  async getInventoryValue(query: ReportQueryDto): Promise<any> {
    this.logger.debug(
      `Generating Inventory Value report with query: ${JSON.stringify(query)}`,
    );

    const where: Prisma.ProductWhereInput = {
      isActive: true, // Solo productos activos
    };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.productId) where.id = query.productId;

    try {
      const products = await this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          currentStock: true,
          costPrice: true,
        },
      });

      let totalValue = new Decimal(0);
      let totalItems = 0;

      products.forEach((product) => {
        if (product.currentStock > 0) {
          const itemValue = product.costPrice.mul(product.currentStock);
          totalValue = totalValue.add(itemValue);
          totalItems += product.currentStock;
        }
      });

      return {
        filtersApplied: {
          categoryId: query.categoryId,
          brandId: query.brandId,
          productId: query.productId,
        },
        summary: {
          numberOfProducts: products.length,
          totalStockItems: totalItems,
          totalInventoryValue: totalValue,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error generating inventory value report: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to generate inventory value report: ${error.message}`,
      );
    }
  }

  // TODO: Añadir más reportes:
  // - Sales by Category/Brand (similar a Sales by Product)
  // - Sales by User
  // - Sales by Payment Method
  // - Low Stock Report (ya existe en InventoryService, podría moverse o duplicarse aquí)
}
