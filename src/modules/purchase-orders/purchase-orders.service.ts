import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import {
  Prisma,
  PurchaseOrder,
  PurchaseOrderStatus,
  MovementType,
} from '@prisma/client';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto, userId: string) {
    const { items, supplierId } = createPurchaseOrderDto;

    // Calculate total amount from items
    const calculatedTotalAmount = items.reduce(
      (sum, item) => sum + item.quantityOrdered * Number(item.unitCostPrice),
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          supplierId,
          totalAmount: calculatedTotalAmount,
          createdByUserId: userId,
          orderDate: createPurchaseOrderDto.orderDate,
          status: PurchaseOrderStatus.PENDING,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantityOrdered: item.quantityOrdered,
              unitCostPrice: Number(item.unitCostPrice),
              quantityReceived: 0,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return purchaseOrder;
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PurchaseOrderWhereUniqueInput;
    where?: Prisma.PurchaseOrderWhereInput;
    orderBy?: Prisma.PurchaseOrderOrderByWithRelationInput;
  }): Promise<PurchaseOrder[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.purchaseOrder.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { orderDate: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
        _count: { select: { items: true } },
      },
    });
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, currentStock: true },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID "${id}" not found`);
    }

    return purchaseOrder;
  }

  async update(
    id: string,
    updatePurchaseOrderDto: UpdatePurchaseOrderDto,
    updatedByUserId: string,
  ): Promise<PurchaseOrder> {
    const {
      status,
      itemsReceived = [],
      ...poUpdateData
    } = updatePurchaseOrderDto;

    return this.prisma.$transaction(async (tx) => {
      const currentPO = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!currentPO) {
        throw new NotFoundException(
          `Purchase Order with ID "${id}" not found.`,
        );
      }

      if (
        currentPO.status === PurchaseOrderStatus.FULLY_RECEIVED ||
        currentPO.status === PurchaseOrderStatus.CANCELLED
      ) {
        throw new ConflictException(
          `Cannot update Purchase Order ${id} because its status is already ${currentPO.status}.`,
        );
      }

      // Prepare update data, excluding items since they'll be handled separately
      const { ...updateInput } = poUpdateData;
      const dataToUpdate: Prisma.PurchaseOrderUpdateInput = {
        ...updateInput,
        status: status || currentPO.status,
        // Exclude items from the update data as they are handled separately
        items: undefined,
      };

      // Process received items if provided
      if (
        itemsReceived.length > 0 &&
        (status === PurchaseOrderStatus.FULLY_RECEIVED ||
          status === PurchaseOrderStatus.PARTIALLY_RECEIVED)
      ) {
        let allItemsFullyReceived = true;

        for (const receivedItem of itemsReceived) {
          const poItem = currentPO.items.find(
            (item) =>
              (receivedItem.purchaseOrderItemId &&
                item.id === receivedItem.purchaseOrderItemId) ||
              (receivedItem.productId &&
                item.productId === receivedItem.productId),
          );

          if (!poItem) {
            throw new NotFoundException(
              `Item not found in Purchase Order ${id} for received data: ${JSON.stringify(receivedItem)}`,
            );
          }

          const quantityReceivedBefore = poItem.quantityReceived ?? 0;
          const quantityReceivedNow = receivedItem.quantityReceivedNow;

          const newQuantityReceived =
            quantityReceivedBefore + quantityReceivedNow;

          if (newQuantityReceived > poItem.quantityOrdered) {
            throw new BadRequestException(
              `Cannot receive ${quantityReceivedNow} for item ${poItem.productId}. Total received (${newQuantityReceived}) would exceed ordered (${poItem.quantityOrdered}).`,
            );
          }

          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: { quantityReceived: newQuantityReceived },
          });

          if (quantityReceivedNow > 0) {
            await this.productsService.updateStock(
              poItem.productId,
              quantityReceivedNow,
              MovementType.PURCHASE_ENTRY,
              updatedByUserId,
              `Received from PO ${id}`,
              undefined,
              id,
              undefined,
              tx as unknown as Omit<
                PrismaService,
                | '$connect'
                | '$disconnect'
                | '$on'
                | '$transaction'
                | '$use'
                | '$extends'
              >,
            );
          }

          if (newQuantityReceived < poItem.quantityOrdered) {
            allItemsFullyReceived = false;
          }
        }

        // Determine final status if not explicitly set to FULLY_RECEIVED
        if (status !== PurchaseOrderStatus.FULLY_RECEIVED) {
          if (allItemsFullyReceived) {
            const allCurrentItems = await tx.purchaseOrderItem.findMany({
              where: { purchaseOrderId: id },
            });
            const allComplete = allCurrentItems.every(
              (item) => (item.quantityReceived ?? 0) >= item.quantityOrdered,
            );
            if (allComplete) {
              dataToUpdate.status = PurchaseOrderStatus.FULLY_RECEIVED;
              dataToUpdate.receivedDate = new Date();
            } else {
              dataToUpdate.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
            }
          } else {
            dataToUpdate.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
          }
        }
      }

      return await tx.purchaseOrder.update({
        where: { id },
        data: dataToUpdate,
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, currentStock: true },
              },
            },
          },
        },
      });
    });
  }
}
