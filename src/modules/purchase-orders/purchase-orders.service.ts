import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service'; // Adjusted path
import { ProductsService } from '../modules/products/products.service'; // Necesario para stock
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import {
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderItemDto,
} from './dto/update-purchase-order.dto';
import {
  Prisma,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  InventoryMovement,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async create(
    createPurchaseOrderDto: CreatePurchaseOrderDto,
    createdByUserId: string,
  ): Promise<PurchaseOrder> {
    const { supplierId, items, ...poData } = createPurchaseOrderDto;

    // --- Inicio Transacción ---
    return this.prisma
      .$transaction(async (tx) => {
        this.logger.log(
          `Creating purchase order for supplier ${supplierId} by user ${createdByUserId}`,
        );

        // 1. Validar Proveedor
        const supplierExists = await tx.supplier.findUnique({
          where: { id: supplierId },
        });
        if (!supplierExists) {
          throw new NotFoundException(
            `Supplier with ID "${supplierId}" not found.`,
          );
        }

        let calculatedTotalAmount = new Decimal(0);
        const poItemsInput: Prisma.PurchaseOrderItemCreateManyPurchaseOrderInput[] =
          [];
        const productIds = items.map((item) => item.productId);

        // 2. Validar Productos y preparar ítems
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
        });
        if (products.length !== productIds.length) {
          throw new NotFoundException(
            'One or more products specified in the order items do not exist.',
          );
        }

        for (const item of items) {
          const product = products.find((p) => p.id === item.productId);
          // Ya validamos que todos existen, pero doble check por si acaso
          if (!product)
            throw new NotFoundException(
              `Product with ID ${item.productId} validation failed unexpectedly.`,
            );

          const purchasePriceDecimal = new Decimal(item.purchasePrice);
          const itemSubtotal = purchasePriceDecimal.mul(item.quantityOrdered);
          calculatedTotalAmount = calculatedTotalAmount.add(itemSubtotal);

          poItemsInput.push({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            purchasePrice: purchasePriceDecimal,
            subtotal: itemSubtotal,
            quantityReceived: 0, // Inicialmente no se ha recibido nada
          });
        }

        // 3. Crear la Orden de Compra (PurchaseOrder)
        const createdPO = await tx.purchaseOrder.create({
          data: {
            ...poData,
            orderDate: poData.orderDate
              ? new Date(poData.orderDate)
              : new Date(),
            expectedDate: poData.expectedDate
              ? new Date(poData.expectedDate)
              : null,
            totalAmount: calculatedTotalAmount,
            supplier: { connect: { id: supplierId } },
            createdByUser: { connect: { id: createdByUserId } },
            items: {
              createMany: {
                data: poItemsInput,
              },
            },
          },
          include: { items: true }, // Incluir ítems en la respuesta inicial
        });

        this.logger.log(`Purchase Order ${createdPO.id} created successfully.`);
        // --- Fin Transacción --- (Commit automático)

        // Recargar con relaciones deseadas fuera de la transacción si es necesario
        return this.findOne(createdPO.id); // Llama a findOne para obtener todas las relaciones
      })
      .catch((error) => {
        this.logger.error(
          `Failed to create purchase order: ${error.message}`,
          error.stack,
        );
        if (
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(
          `Failed to create purchase order: ${error.message}`,
        );
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
        createdByUser: { select: { id: true, username: true, fullName: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findOne(id: string): Promise<PurchaseOrder | null> {
    const purchaseOrder = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdByUser: { select: { id: true, username: true, fullName: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, currentStock: true },
            },
          },
          orderBy: { createdAt: 'asc' }, // Ordenar ítems por creación
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
    const { status, itemsReceived, ...poUpdateData } = updatePurchaseOrderDto;

    // --- Inicio Transacción --- (Especialmente importante si se reciben ítems)
    return this.prisma
      .$transaction(async (tx) => {
        this.logger.log(
          `Updating Purchase Order ${id} by user ${updatedByUserId}. Status: ${status}`,
        );

        // 1. Obtener la orden de compra actual y sus ítems
        const currentPO = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!currentPO) {
          throw new NotFoundException(
            `Purchase Order with ID "${id}" not found.`,
          );
        }
        // Validar que no se pueda modificar una orden ya recibida o cancelada
        if (
          currentPO.status === PurchaseOrderStatus.RECEIVED ||
          currentPO.status === PurchaseOrderStatus.CANCELLED
        ) {
          throw new ConflictException(
            `Cannot update Purchase Order ${id} because its status is already ${currentPO.status}.`,
          );
        }

        // 2. Preparar datos básicos de actualización
        const dataToUpdate: Prisma.PurchaseOrderUpdateInput = {
          ...poUpdateData,
          expectedDate: poUpdateData.expectedDate
            ? new Date(poUpdateData.expectedDate)
            : currentPO.expectedDate,
          receivedDate: poUpdateData.receivedDate
            ? new Date(poUpdateData.receivedDate)
            : currentPO.receivedDate,
          // Podríamos añadir un campo 'lastUpdatedByUserId'
        };
        if (status) dataToUpdate.status = status;

        // 3. Procesar ítems recibidos si se proporcionan y el estado cambia a RECEIVED o PARTIALLY_RECEIVED
        let allItemsFullyReceived = true; // Asumir que sí hasta que se demuestre lo contrario
        if (
          itemsReceived &&
          itemsReceived.length > 0 &&
          (status === PurchaseOrderStatus.RECEIVED ||
            status === PurchaseOrderStatus.PARTIALLY_RECEIVED)
        ) {
          this.logger.log(
            `Processing ${itemsReceived.length} received items for PO ${id}.`,
          );
          dataToUpdate.receivedDate = new Date(); // Marcar fecha de recepción actual si no se proporcionó

          for (const receivedItem of itemsReceived) {
            // Encontrar el ítem correspondiente en la orden de compra actual
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
                `Cannot receive ${quantityReceivedNow} for item ${poItem.productId} (PO Item ID: ${poItem.id}). Total received (${newQuantityReceived}) would exceed quantity ordered (${poItem.quantityOrdered}).`,
              );
            }
            if (quantityReceivedNow < 0) {
              throw new BadRequestException(
                `Quantity received cannot be negative for item ${poItem.productId} (PO Item ID: ${poItem.id}).`,
              );
            }

            // Actualizar la cantidad recibida en el PurchaseOrderItem
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { quantityReceived: newQuantityReceived },
            });
            this.logger.debug(
              `Updated PO Item ${poItem.id} (Product: ${poItem.productId}): quantityReceived set to ${newQuantityReceived}`,
            );

            // Actualizar Stock del Producto (si se recibió algo)
            if (quantityReceivedNow > 0) {
              await this.productsService.updateStock(
                poItem.productId,
                quantityReceivedNow, // Cantidad positiva para entrada
                InventoryMovement.IN_PURCHASE,
                updatedByUserId,
                `Received from PO ${id}`, // reason
                undefined, // relatedSaleId
                id, // relatedPurchaseOrderId
                undefined, // relatedReturnId
                tx, // Pasar cliente de transacción
              );
              this.logger.debug(
                `Stock updated for Product ${poItem.productId} (+${quantityReceivedNow})`,
              );
            }

            // Verificar si este ítem ya está completamente recibido
            if (newQuantityReceived < poItem.quantityOrdered) {
              allItemsFullyReceived = false;
            }
          } // Fin del bucle de itemsReceived

          // Determinar el estado final si no se especificó explícitamente RECEIVED
          if (status !== PurchaseOrderStatus.RECEIVED) {
            if (allItemsFullyReceived) {
              // Si todos los ítems (incluyendo los no mencionados en este update) están completos, marcar como RECEIVED
              const allCurrentItems = await tx.purchaseOrderItem.findMany({
                where: { purchaseOrderId: id },
              });
              const allComplete = allCurrentItems.every(
                (item) => (item.quantityReceived ?? 0) >= item.quantityOrdered,
              );
              if (allComplete) {
                this.logger.log(
                  `All items for PO ${id} are now fully received. Setting status to RECEIVED.`,
                );
                dataToUpdate.status = PurchaseOrderStatus.RECEIVED;
                if (!dataToUpdate.receivedDate)
                  dataToUpdate.receivedDate = new Date(); // Asegurar fecha si se completa ahora
              } else {
                this.logger.log(`PO ${id} is now PARTIALLY_RECEIVED.`);
                dataToUpdate.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
              }
            } else {
              this.logger.log(`PO ${id} is now PARTIALLY_RECEIVED.`);
              dataToUpdate.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
            }
          }
        } else if (status && status !== currentPO.status) {
          // Si solo cambia el estado (ej: a SENT o CANCELLED) sin recibir ítems
          this.logger.log(`Updating status only for PO ${id} to ${status}.`);
          dataToUpdate.status = status;
          if (status === PurchaseOrderStatus.CANCELLED) {
            // TODO: Podría haber lógica adicional para cancelación (ej: notificar proveedor)
            // No se revierte stock aquí, ya que no se había incrementado.
          }
        } else if (itemsReceived && itemsReceived.length > 0) {
          // Se enviaron itemsReceived pero el estado no es RECEIVED o PARTIALLY_RECEIVED
          throw new BadRequestException(
            'Items can only be received when setting status to RECEIVED or PARTIALLY_RECEIVED.',
          );
        }

        // 4. Actualizar la Orden de Compra
        const updatedPO = await tx.purchaseOrder.update({
          where: { id },
          data: dataToUpdate,
        });

        this.logger.log(`Purchase Order ${id} updated successfully.`);
        // --- Fin Transacción --- (Commit automático)

        // Recargar con relaciones deseadas
        return this.findOne(updatedPO.id);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to update purchase order ${id}: ${error.message}`,
          error.stack,
        );
        if (
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(
          `Failed to update purchase order: ${error.message}`,
        );
      });
  }

  // remove(id: string) {
  //   Generalmente no se borran, se cancelan.
  //   Si se implementa, debe asegurar que no se haya recibido nada.
  // }
}
