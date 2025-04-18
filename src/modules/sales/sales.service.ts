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
import {
  Prisma,
  Sale,
  SaleDetail,
  InventoryMovementType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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

    // --- Inicio de la Transacción ---
    return this.prisma
      .$transaction(async (tx) => {
        this.logger.log(`Starting sale transaction for user ${userId}`);

        let calculatedSubtotal = new Decimal(0);
        const saleDetailsInput: Prisma.SaleDetailCreateManySaleInput[] = [];
        const productStockUpdates: {
          productId: string;
          quantityChange: number;
        }[] = [];

        // 1. Validar Cliente (si se proporciona)
        if (customerId) {
          const customerExists = await tx.customer.findUnique({
            where: { id: customerId },
          });
          if (!customerExists) {
            throw new NotFoundException(
              `Customer with ID "${customerId}" not found.`,
            );
          }
        }

        // 2. Procesar cada ítem de la venta
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product with ID "${item.productId}" not found.`,
            );
          }
          if (!product.isActive) {
            throw new ConflictException(
              `Product "${product.name}" (ID: ${item.productId}) is not active.`,
            );
          }

          // 2a. Verificar Stock
          if (product.currentStock < item.quantity) {
            throw new ConflictException(
              `Insufficient stock for product "${product.name}" (ID: ${item.productId}). Requested: ${item.quantity}, Available: ${product.currentStock}`,
            );
          }

          // 2b. Calcular totales del ítem (simplificado, sin descuentos/impuestos por ítem por ahora)
          const itemSubtotal = product.sellingPrice.mul(item.quantity);
          // const itemTaxes = new Decimal(0); // Calcular impuestos por ítem si es necesario
          // const itemDiscount = new Decimal(0); // Calcular descuentos por ítem si es necesario
          const itemTotal = itemSubtotal; // - itemDiscount + itemTaxes;

          calculatedSubtotal = calculatedSubtotal.add(itemSubtotal);

          // 2c. Preparar datos para SaleDetail
          saleDetailsInput.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.sellingPrice, // Guardar precio al momento de la venta
            subtotal: itemSubtotal,
            total: itemTotal,
            // discountAmount: itemDiscount,
            // taxesApplied: itemTaxes,
          });

          // 2d. Preparar actualización de stock (negativo para salida)
          productStockUpdates.push({
            productId: item.productId,
            quantityChange: -item.quantity, // Negativo porque es una salida
          });
        } // Fin del bucle de items

        // 3. Calcular totales de la venta (simplificado)
        // TODO: Implementar lógica de impuestos y descuentos más compleja si es necesario
        let saleTotal = calculatedSubtotal;
        const saleDiscountAmount = new Decimal(discountAmount ?? '0.00');
        const saleDiscountPercent = new Decimal(discountPercent ?? '0.00');

        // Aplicar descuento (ejemplo simple: aplicar porcentaje primero, luego monto fijo)
        if (saleDiscountPercent.greaterThan(0)) {
          const discountFromPercent = saleTotal
            .mul(saleDiscountPercent)
            .div(100);
          saleTotal = saleTotal.sub(discountFromPercent);
        }
        if (saleDiscountAmount.greaterThan(0)) {
          saleTotal = saleTotal.sub(saleDiscountAmount);
        }
        // Asegurarse de que el total no sea negativo
        if (saleTotal.lessThan(0)) {
          saleTotal = new Decimal(0);
        }

        const calculatedTaxes = new Decimal(0); // TODO: Calcular impuestos basados en configuración o productos
        saleTotal = saleTotal.add(calculatedTaxes);

        // 4. Crear el registro de Venta (Sale)
        const createdSale = await tx.sale.create({
          data: {
            ...saleData,
            subtotal: calculatedSubtotal,
            taxes: calculatedTaxes,
            total: saleTotal,
            discountAmount: saleDiscountAmount,
            discountPercent: saleDiscountPercent,
            user: { connect: { id: userId } }, // Conectar con el usuario que realiza la venta
            ...(customerId && { customer: { connect: { id: customerId } } }), // Conectar cliente si existe
            saleDetails: {
              createMany: {
                // Crear todos los detalles de la venta
                data: saleDetailsInput,
              },
            },
          },
          include: { saleDetails: true }, // Incluir detalles en la respuesta
        });

        this.logger.log(`Sale record ${createdSale.id} created.`);

        // 5. Actualizar Stock de Productos y crear movimientos de inventario
        for (const update of productStockUpdates) {
          this.logger.debug(
            `Updating stock for product ${update.productId}: ${update.quantityChange}`,
          );
          // Usamos el servicio de productos, pasándole el cliente de transacción 'tx'
          // Es crucial que ProductsService.updateStock acepte un cliente Prisma opcional
          // y lo use si se proporciona, para que todo ocurra en la misma transacción.
          // ¡NECESITA MODIFICACIÓN EN ProductsService!
          await this.productsService.updateStock(
            update.productId,
            update.quantityChange,
            InventoryMovementType.OUT_SALE,
            userId,
            undefined, // reason
            createdSale.id, // relatedSaleId
            undefined, // relatedPurchaseOrderId
            undefined, // relatedReturnId
            tx, // <--- Pasar el cliente de transacción
          );
        }

        this.logger.log(
          `Stock updated for sale ${createdSale.id}. Transaction successful.`,
        );
        // Si todo va bien, la transacción se confirma automáticamente al salir del bloque async (tx) => {...}

        // 6. Devolver la venta creada con sus detalles
        // Necesitamos volver a buscarla para incluir todas las relaciones deseadas
        const finalSale = await tx.sale.findUnique({
          where: { id: createdSale.id },
          include: {
            user: { select: { id: true, username: true, fullName: true } }, // Incluir info básica del usuario
            customer: true, // Incluir info del cliente si existe
            saleDetails: {
              // Incluir detalles de la venta
              include: {
                product: {
                  select: { id: true, name: true, sku: true, barcode: true },
                }, // Incluir info básica del producto
              },
            },
          },
        });

        if (!finalSale) {
          // Esto no debería ocurrir si la creación fue exitosa, pero por seguridad
          throw new InternalServerErrorException(
            'Failed to retrieve the created sale details.',
          );
        }

        return finalSale;
      })
      .catch((error) => {
        // Loguear el error específico que causó el fallo de la transacción
        this.logger.error(
          `Sale transaction failed for user ${userId}: ${error.message}`,
          error.stack,
        );
        // Re-lanzar el error para que NestJS lo maneje (o lanzar uno más específico)
        if (
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof BadRequestException
        ) {
          throw error; // Re-lanzar errores de negocio conocidos
        }
        // Para otros errores (ej: DB, conexión), lanzar un error genérico
        throw new InternalServerErrorException(
          `Failed to create sale: ${error.message}`,
        );
      });
    // --- Fin de la Transacción ---
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
      orderBy: orderBy ?? { saleDate: 'desc' }, // Ordenar por fecha descendente por defecto
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        customer: { select: { id: true, fullName: true } },
        _count: { select: { saleDetails: true } }, // Contar items
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
    if (!sale) {
      throw new NotFoundException(`Sale with ID "${id}" not found`);
    }
    return sale;
  }

  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
    userId: string,
  ): Promise<Sale> {
    // Generalmente, las ventas completadas no se modifican extensamente,
    // solo se actualiza el estado (ej: a CANCELLED) o notas.
    // La cancelación debería tener su propio flujo y revertir stock.

    const existingSale = await this.findOne(id); // Verifica que existe

    // TODO: Implementar lógica de cancelación si se cambia a CANCELLED
    if (
      updateSaleDto.status === SaleStatus.CANCELLED &&
      existingSale.status !== SaleStatus.CANCELLED
    ) {
      this.logger.warn(
        `Attempting to cancel sale ${id}. This requires stock reversal logic.`,
      );
      // ¡¡¡IMPLEMENTAR LÓGICA DE REVERSIÓN DE STOCK EN UNA TRANSACCIÓN!!!
      // 1. Iniciar transacción
      // 2. Por cada saleDetail de la venta original:
      //    - Llamar a productsService.updateStock con cantidad POSITIVA y tipo RETURN_IN o similar, pasando 'tx'
      // 3. Actualizar el estado de la venta a CANCELLED dentro de la transacción
      // 4. Confirmar transacción
      throw new BadRequestException(
        'Sale cancellation logic not fully implemented yet.',
      );
    }

    try {
      return await this.prisma.sale.update({
        where: { id },
        data: {
          ...updateSaleDto,
          // Podrías añadir un campo 'lastUpdatedByUserId: userId'
        },
        include: {
          // Incluir relaciones en la respuesta actualizada
          user: { select: { id: true, username: true, fullName: true } },
          customer: true,
          saleDetails: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update sale ${id}: ${error.message}`,
        error.stack,
      );
      // Manejar errores específicos si es necesario
      throw new InternalServerErrorException(
        `Failed to update sale: ${error.message}`,
      );
    }
  }

  // remove(id: string) {
  //   Generalmente no se borran ventas, se cancelan.
  //   Si se implementa, debe manejar la reversión de stock como en update/cancel.
  // }
}
