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
import { Prisma, Sale, MovementType, SaleStatus } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService, // Inyectar ProductsService
  ) {}

  async create(createSaleDto: CreateSaleDto, userId: string) {
    const {
      customerId,
      items,
      paymentMethod,
      discountAmount = 0,
    } = createSaleDto;

    return this.prisma.$transaction(async (tx) => {
      // Calculate subtotal and total
      const itemsWithCalculations = items.map((item) => ({
        ...item,
        itemSubtotal: item.quantity * item.unitPrice,
        itemTotal:
          item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100) -
          (item.itemDiscountAmount || 0),
      }));

      const subtotal = itemsWithCalculations.reduce(
        (sum, item) => sum + item.itemSubtotal,
        0,
      );
      const totalTax = itemsWithCalculations.reduce(
        (sum, item) => sum + (item.itemSubtotal * (item.taxRate || 0)) / 100,
        0,
      );
      const totalAmount = subtotal + totalTax - discountAmount;

      // Create the sale with proper fields
      const sale = await tx.sale.create({
        data: {
          customerId,
          userId,
          subtotal,
          totalAmount,
          paymentMethod,
          discountAmount,
          status: 'COMPLETED' as SaleStatus,
          taxDetails: { total: totalTax },
          saleDetails: {
            create: itemsWithCalculations.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              itemDiscountAmount: item.itemDiscountAmount || 0,
              itemSubtotal: item.itemSubtotal,
              itemTotal: item.itemTotal,
              itemTaxDetails: { rate: item.taxRate || 0 },
            })),
          },
        },
        include: {
          customer: true,
          user: true,
          saleDetails: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update inventory
      for (const item of items) {
        await this.updateInventory(tx, {
          productId: item.productId,
          quantity: -item.quantity,
          userId,
          saleId: sale.id,
        });
      }

      return sale;
    });
  }

  private async updateInventory(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      quantity: number;
      userId: string;
      saleId: string;
    },
  ) {
    const { productId, quantity, userId, saleId } = params;

    // Update product stock
    await tx.product.update({
      where: { id: productId },
      data: { currentStock: { increment: quantity } },
    });

    // Create inventory movement
    await tx.inventoryMovement.create({
      data: {
        productId,
        quantity,
        movementType: MovementType.SALE_EXIT,
        userId,
        saleId,
      },
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
