import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service'; // Importar ProductsService
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Prisma, Sale } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService, // Inyectar ProductsService
  ) {}

  async create(createSaleDto: CreateSaleDto, userId: string): Promise<Sale> {
    const { items, customerId, discountAmount, discountPercent, ...saleData } =
      createSaleDto;
    return this.prisma.$transaction(async (tx) => {
      let calculatedSubtotal = 0;
      const saleDetailsInput: any[] = [];
      const productStockUpdates: {
        productId: string;
        quantityChange: number;
      }[] = [];
      if (customerId) {
        const customerExists = await tx.customer.findUnique({
          where: { id: customerId },
        });
        if (!customerExists)
          throw new NotFoundException(
            `Customer with ID "${customerId}" not found.`,
          );
      }
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product)
          throw new NotFoundException(
            `Product with ID "${item.productId}" not found.`,
          );
        if (!product.isActive)
          throw new ConflictException(
            `Product "${product.name}" (ID: ${item.productId}) is not active.`,
          );
        if (product.currentStock < item.quantity)
          throw new ConflictException(
            `Insufficient stock for product "${product.name}" (ID: ${item.productId}). Requested: ${item.quantity}, Available: ${product.currentStock}`,
          );
        const itemSubtotal = product.sellingPrice * item.quantity;
        const itemTotal = itemSubtotal;
        calculatedSubtotal += itemSubtotal;
        saleDetailsInput.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          total: itemTotal,
        });
        productStockUpdates.push({
          productId: item.productId,
          quantityChange: -item.quantity,
        });
      }
      let saleTotal = calculatedSubtotal;
      const saleDiscountAmount = Number(discountAmount ?? '0.00');
      const saleDiscountPercent = Number(discountPercent ?? '0.00');
      if (saleDiscountPercent > 0)
        saleTotal -= (saleTotal * saleDiscountPercent) / 100;
      if (saleDiscountAmount > 0) saleTotal -= saleDiscountAmount;
      if (saleTotal < 0) saleTotal = 0;
      const calculatedTaxes = 0;
      saleTotal += calculatedTaxes;
      const createdSale = await tx.sale.create({
        data: {
          ...saleData,
          subtotal: calculatedSubtotal,
          total: saleTotal,
          discountAmount: saleDiscountAmount,
          discountPercent: saleDiscountPercent,
          userId: userId,
          ...(customerId && { customerId: customerId }),
          saleDetails: { createMany: { data: saleDetailsInput } },
        },
        include: { saleDetails: true },
      });
      for (const update of productStockUpdates) {
        await this.productsService.updateStock(
          update.productId,
          update.quantityChange,
          'SALE_EXIT',
          userId,
          undefined,
          createdSale.id,
          undefined,
          undefined,
          tx,
        );
      }
      const finalSale = await tx.sale.findUnique({
        where: { id: createdSale.id },
        include: {
          user: { select: { id: true, username: true, fullName: true } },
          customer: true,
          saleDetails: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true },
              },
            },
          },
        },
      });
      if (!finalSale)
        throw new InternalServerErrorException(
          'Failed to retrieve the created sale details.',
        );
      return finalSale;
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.SaleWhereUniqueInput;
    where?: Prisma.SaleWhereInput;
    orderBy?: Prisma.SaleOrderByWithRelationInput;
  }): Promise<Sale[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.sale.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { saleTimestamp: 'desc' },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        customer: { select: { id: true, fullName: true } },
        saleDetails: true,
      },
    });
  }

  async findOne(id: string): Promise<Sale | null> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        customer: true,
        saleDetails: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitOfMeasure: true,
              },
            },
          },
        },
      },
    });
    if (!sale) throw new NotFoundException(`Sale with ID "${id}" not found`);
    return sale;
  }

  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
    userId: string,
  ): Promise<Sale> {
    const existingSale = await this.findOne(id);
    if (!existingSale)
      throw new NotFoundException(`Sale with ID "${id}" not found`);
    if (updateSaleDto.status === 'VOIDED' && existingSale.status !== 'VOIDED') {
      throw new BadRequestException(
        'Sale cancellation logic not fully implemented yet.',
      );
    }
    try {
      return await this.prisma.sale.update({
        where: { id },
        data: { ...updateSaleDto },
        include: {
          user: { select: { id: true, username: true, fullName: true } },
          customer: true,
          saleDetails: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      });
    } catch {
      throw new InternalServerErrorException('Failed to update sale.');
    }
  }

  // remove(id: string) {
  //   Generalmente no se borran ventas, se cancelan.
  //   Si se implementa, debe manejar la reversión de stock como en update/cancel.
  // }
}
