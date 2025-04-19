import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Prisma, SaleStatus } from '@prisma/client';

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
      status: query.saleStatus ?? SaleStatus.COMPLETED,
    };
    if (query.startDate || query.endDate) {
      where.saleTimestamp = {};
      if (query.startDate) where.saleTimestamp.gte = new Date(query.startDate);
      if (query.endDate) where.saleTimestamp.lte = new Date(query.endDate);
    }
    if (query.userId) where.userId = query.userId;
    if (query.customerId) where.customerId = query.customerId;

    try {
      const result = await this.prisma.sale.aggregate({
        where,
        _count: { id: true },
        _sum: {
          subtotal: true,
          totalAmount: true,
          discountAmount: true,
        },
        _avg: { totalAmount: true },
      });
      return {
        period: { startDate: query.startDate, endDate: query.endDate },
        filtersApplied: {
          status: where.status,
          userId: query.userId,
          customerId: query.customerId,
        },
        summary: {
          numberOfSales: result._count.id ?? 0,
          totalSubtotal: result._sum.subtotal ?? 0,
          totalDiscounts: result._sum.discountAmount ?? 0,
          totalRevenue: result._sum.totalAmount ?? 0,
          averageSaleValue: result._avg.totalAmount ?? 0,
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
      saleWhere.saleTimestamp = {};
      if (query.startDate)
        saleWhere.saleTimestamp.gte = new Date(query.startDate);
      if (query.endDate) saleWhere.saleTimestamp.lte = new Date(query.endDate);
    }
    if (query.userId) saleWhere.userId = query.userId;

    const productWhere: Prisma.ProductWhereInput = {};
    if (query.categoryId) productWhere.categoryId = query.categoryId;
    if (query.brandId) productWhere.brandId = query.brandId;

    try {
      const result = await this.prisma.saleDetail.groupBy({
        by: ['productId'],
        where: {
          sale: saleWhere,
          product: productWhere,
          ...(query.productId && { productId: query.productId }),
        },
        _sum: {
          quantity: true,
          itemTotal: true,
          itemSubtotal: true,
        },
        _count: { id: true },
        orderBy: {
          _sum: { quantity: 'desc' },
        },
      });

      const productIds = result.map((item) => item.productId);
      const productsInfo = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true, sellingPrice: true },
      });
      const productsMap = new Map(productsInfo.map((p) => [p.id, p]));

      return result.map((item) => ({
        product: productsMap.get(item.productId) || {
          id: item.productId,
          name: 'Unknown Product',
        },
        totalQuantitySold: item._sum.quantity ?? 0,
        totalRevenue: item._sum.itemTotal ?? 0,
        totalSubtotal: item._sum.itemSubtotal ?? 0,
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

    const where: Prisma.ProductWhereInput = { isActive: true };
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

      let totalValue = 0;
      let totalItems = 0;

      products.forEach((product) => {
        if (product.currentStock > 0) {
          totalValue += product.costPrice * product.currentStock;
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
