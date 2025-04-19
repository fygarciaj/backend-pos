import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service'; // Para ajustar stock
import { CreateReturnDto } from './dto/create-return.dto';
import { Prisma, Return } from '@prisma/client';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  private async processReturnedItems(
    tx: Omit<
      PrismaService,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    returnedItems: Array<{ productId: string; quantity: number }>,
    userId: string,
    returnId: string,
  ) {
    for (const item of returnedItems) {
      await this.productsService.updateStock(
        item.productId,
        item.quantity,
        MovementType.CUSTOMER_RETURN,
        userId,
        `Return ID: ${returnId}`,
        undefined,
        undefined,
        returnId,
        tx,
      );
    }
  }

  async create(
    createReturnDto: CreateReturnDto,
    processedByUserId: string,
  ): Promise<Return> {
    const { originalSaleId, items, amountRefunded, ...returnData } =
      createReturnDto;

    // --- Inicio Transacción ---
    return this.prisma
      .$transaction(async (tx) => {
        this.logger.log(
          `Processing return for sale ${originalSaleId} by user ${processedByUserId}`,
        );

        // 1. Validar Venta Original
        const originalSale = await tx.sale.findUnique({
          where: { id: originalSaleId },
          include: { saleDetails: true }, // Incluir detalles para validación
        });
        if (!originalSale) {
          throw new NotFoundException(
            `Original sale with ID "${originalSaleId}" not found.`,
          );
        }
        // Opcional: Validar si la venta ya fue completamente devuelta o cancelada
        if (originalSale.status === 'VOIDED') {
          this.logger.warn(
            `Processing return against sale ${originalSaleId} which has status ${originalSale.status}`,
          );
        }

        const returnedItems = items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));
        const amountRefundedNumber = Number(amountRefunded ?? '0.00');

        // 2. Validar y Procesar cada Ítem Devuelto
        for (const item of items) {
          // 2a. Validar que el producto existe (aunque debería existir si estuvo en la venta)
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new NotFoundException(
              `Product with ID "${item.productId}" specified in return items not found.`,
            );
          }

          // 2b. Validar que la cantidad devuelta no exceda la cantidad vendida originalmente
          const originalSaleDetail = originalSale.saleDetails.find(
            (detail) => detail.productId === item.productId,
          );
          if (!originalSaleDetail) {
            throw new BadRequestException(
              `Product "${product.name}" (ID: ${item.productId}) was not found in the original sale ${originalSaleId}.`,
            );
          }
          // TODO: Considerar devoluciones previas para este mismo SaleDetail si se permiten devoluciones parciales múltiples.
          if (item.quantity > originalSaleDetail.quantity) {
            throw new BadRequestException(
              `Cannot return ${item.quantity} of product "${product.name}" (ID: ${item.productId}). Only ${originalSaleDetail.quantity} were sold in the original sale ${originalSaleId}.`,
            );
          }
        } // Fin del bucle de items

        // 3. Crear el registro de Devolución (Return)
        const createdReturn = await tx.return.create({
          data: {
            ...returnData,
            refundedAmount: amountRefundedNumber,
            originalSaleId: originalSaleId,
            processedByUserId: processedByUserId,
            returnedItems: returnedItems,
          },
        });
        this.logger.log(
          `Return record ${createdReturn.id} created for sale ${originalSaleId}.`,
        );

        // 4. Actualizar Stock de Productos y crear movimientos de inventario
        await this.processReturnedItems(
          tx,
          returnedItems,
          processedByUserId,
          createdReturn.id,
        );
        this.logger.log(`Stock updated for return ${createdReturn.id}.`);

        // 5. Opcional: Actualizar estado de la Venta Original
        // Podríamos marcar la venta original como 'REFUNDED' o 'PARTIALLY_REFUNDED'
        // Esto requiere lógica más compleja para verificar si todos los ítems fueron devueltos.
        // Por ahora, lo omitimos para simplificar.
        // await tx.sale.update({ where: { id: originalSaleId }, data: { status: SaleStatus.REFUNDED } });

        // --- Fin Transacción --- (Commit automático)

        return createdReturn;
      })
      .catch((error) => {
        this.logger.error(
          `Failed to process return for sale ${originalSaleId}: ${error.message}`,
          error.stack,
        );
        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException ||
          error instanceof ConflictException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(
          `Failed to process return: ${error.message}`,
        );
      });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ReturnWhereUniqueInput;
    where?: Prisma.ReturnWhereInput;
    orderBy?: Prisma.ReturnOrderByWithRelationInput;
  }): Promise<Return[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.return.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { returnTimestamp: 'desc' },
    });
  }

  async findOne(id: string): Promise<Return> {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
    });
    if (!returnRecord) {
      throw new NotFoundException(`Return with ID "${id}" not found`);
    }
    return returnRecord;
  }

  // Generalmente, las devoluciones no se actualizan ni se borran una vez procesadas.
  // Si se cometió un error, se debería crear una transacción correctiva (ej: una venta o ajuste).
}
