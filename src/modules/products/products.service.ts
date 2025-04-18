import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service'; // Ajusta la ruta si es necesario
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, Product } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library'; // Importa Decimal

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const {
      images,
      categoryId,
      brandId,
      costPrice,
      sellingPrice,
      weight,
      ...productData
    } = createProductDto;

    // Convertir precios y peso a Decimal si vienen como string desde el DTO
    const costPriceDecimal = new Decimal(costPrice);
    const sellingPriceDecimal = new Decimal(sellingPrice);
    const weightDecimal = weight ? new Decimal(weight) : null;

    const productCreateInput: Prisma.ProductCreateInput = {
      ...productData,
      costPrice: costPriceDecimal,
      sellingPrice: sellingPriceDecimal,
      weight: weightDecimal,
      category: { connect: { id: categoryId } },
      brand: { connect: { id: brandId } },
      // Conectar ubicación si se proporciona
      ...(createProductDto.locationId && {
        location: { connect: { id: createProductDto.locationId } },
      }),
      // Crear imágenes si se proporcionan
      ...(images &&
        images.length > 0 && {
          images: {
            create: images.map((img) => ({
              url: img.url,
              altText: img.altText,
              order: img.order,
            })),
          },
        }),
    };

    return this.prisma.product.create({
      data: productCreateInput,
      include: { images: true, category: true, brand: true, location: true }, // Incluir relaciones en la respuesta
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProductWhereUniqueInput;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }): Promise<Product[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.product.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: { category: true, brand: true, images: true, location: true }, // Incluir relaciones básicas
    });
  }

  async findOne(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { order: 'asc' } }, // Ordenar imágenes
        location: true,
        // Podrías incluir más relaciones si es necesario aquí
        // saleDetails: true, // Cuidado con cargar demasiados datos por defecto
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    // Primero, verifica si el producto existe
    await this.findOne(id); // Esto lanzará NotFoundException si no existe

    const {
      images,
      categoryId,
      brandId,
      costPrice,
      sellingPrice,
      weight,
      ...productData
    } = updateProductDto;

    // Prepara los datos para actualizar, convirtiendo decimales si existen
    const dataToUpdate: Prisma.ProductUpdateInput = { ...productData };
    if (costPrice !== undefined)
      dataToUpdate.costPrice = new Decimal(costPrice);
    if (sellingPrice !== undefined)
      dataToUpdate.sellingPrice = new Decimal(sellingPrice);
    if (weight !== undefined) dataToUpdate.weight = new Decimal(weight);
    if (categoryId) dataToUpdate.category = { connect: { id: categoryId } };
    if (brandId) dataToUpdate.brand = { connect: { id: brandId } };
    if (updateProductDto.locationId !== undefined) {
      // Permite desconectar o conectar ubicación
      dataToUpdate.location = updateProductDto.locationId
        ? { connect: { id: updateProductDto.locationId } }
        : { disconnect: true };
    }

    // Manejo de imágenes (ejemplo simple: reemplazar todas las imágenes)
    // Una lógica más compleja podría permitir añadir/eliminar imágenes individuales
    if (images) {
      // Borrar imágenes existentes y crear las nuevas en una transacción
      return this.prisma.$transaction(async (tx) => {
        await tx.productImage.deleteMany({ where: { productId: id } });
        const updatedProduct = await tx.product.update({
          where: { id },
          data: {
            ...dataToUpdate,
            images: {
              create: images.map((img) => ({
                url: img.url,
                altText: img.altText,
                order: img.order,
              })),
            },
          },
          include: {
            images: true,
            category: true,
            brand: true,
            location: true,
          },
        });
        return updatedProduct;
      });
    } else {
      // Actualizar sin tocar las imágenes si no se proporcionan en el DTO
      return this.prisma.product.update({
        where: { id },
        data: dataToUpdate,
        include: { images: true, category: true, brand: true, location: true },
      });
    }
  }

  async remove(id: string): Promise<Product> {
    // Primero, verifica si el producto existe
    await this.findOne(id); // Esto lanzará NotFoundException si no existe

    // Considera las implicaciones de borrar un producto (historial de ventas, etc.)
    // Prisma por defecto no permitirá borrar si hay relaciones restrictivas.
    // Podrías necesitar lógica adicional aquí (ej: marcar como inactivo en lugar de borrar)
    try {
      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (error) {
      // Manejar errores específicos de Prisma si es necesario (ej: P2003 Foreign key constraint failed)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record to delete does not exist. (Ya manejado por findOne)
          throw new NotFoundException(`Product with ID "${id}" not found`);
        }
        // Podrías lanzar un BadRequestException si hay dependencias que impiden borrar
        console.error('Prisma Error Code:', error.code);
        throw new Error(
          `Could not delete product due to dependencies or other error.`,
        );
      }
      throw error; // Re-lanzar otros errores
    }
  }

  // --- Métodos Adicionales (Ejemplos) ---

  async findByBarcode(barcode: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true, brand: true, images: true, location: true },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with barcode "${barcode}" not found`,
      );
    }
    return product;
  }

  async searchByName(term: string): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } }, // Búsqueda insensible a mayúsculas/minúsculas (depende de DB)
          { description: { contains: term, mode: 'insensitive' } },
          { tags: { contains: term, mode: 'insensitive' } }, // Asumiendo tags como texto
        ],
        isActive: true, // Opcional: buscar solo activos
      },
      include: { category: true, brand: true },
      take: 20, // Limitar resultados
    });
  }

      /**
   * Updates the stock for a product and creates an inventory movement record.
   * Can be executed within a Prisma transaction by passing the transaction client.
   * @param productId - ID of the product to update.
   * @param quantityChange - Amount to change stock by (positive for increase, negative for decrease).
   * @param movementType - Type of inventory movement.
   * @param userId - Optional ID of the user performing the action.
   * @param reason - Optional reason for adjustment movements.
   * @param relatedSaleId - Optional ID of the related sale.
   * @param relatedPurchaseOrderId - Optional ID of the related purchase order.
   * @param relatedReturnId - Optional ID of the related return.
   * @param tx - Optional Prisma transaction client.
   * @returns The updated product.
   */
  async updateStock(
    productId: string,
    quantityChange: number,
    movementType: InventoryMovementType,
    userId?: string,
    reason?: string,
    relatedSaleId?: string,
    relatedPurchaseOrderId?: string,
    relatedReturnId?: string,
    // Añadir parámetro opcional para el cliente de transacción
    tx?: Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  ): Promise<Product> {

    // Usar el cliente de transacción 'tx' si se proporciona, de lo contrario usar 'this.prisma'
    const prismaClient = tx || this.prisma;
    this.logger.debug(`updateStock called for product ${productId}, change ${quantityChange}, type ${movementType}. Using ${tx ? 'transaction client' : 'default client'}.`);


    // --- Lógica dentro de la función (puede ser llamada standalone o dentro de otra transacción) ---
    // Si no se pasa 'tx', podríamos envolver esto en su propia transacción aquí,
    // pero es mejor que el llamador (SalesService) controle la transacción completa.

    const product = await prismaClient.product.findUnique({ // Usar prismaClient
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found for stock update.`);
    }

    const newStock = product.currentStock + quantityChange;

    // Validar stock negativo solo si es una salida por venta (u otro tipo relevante)
    if (newStock < 0 && (movementType === InventoryMovementType.OUT_SALE || movementType === InventoryMovementType.ADJUSTMENT_OUT)) {
         this.logger.error(`Insufficient stock for product ${product.name} (ID: ${productId}). Required: ${Math.abs(quantityChange)}, Available: ${product.currentStock}`);
         throw new ConflictException(`Insufficient stock for product ${product.name} (ID: ${productId}). Required: ${Math.abs(quantityChange)}, Available: ${product.currentStock}`);
    }

    // Crear el registro de movimiento de inventario
    await prismaClient.inventoryMovement.create({ // Usar prismaClient
      data: {
        productId: productId,
        quantity: quantityChange,
        type: movementType,
        userId: userId,
        reason: reason,
        relatedSaleId: relatedSaleId,
        relatedPurchaseOrderId: relatedPurchaseOrderId,
        relatedReturnId: relatedReturnId,
      },
    });
    this.logger.debug(`Inventory movement created for product ${productId}.`);


    // Actualizar el stock del producto
    const updatedProduct = await prismaClient.product.update({ // Usar prismaClient
      where: { id: productId },
      data: { currentStock: newStock },
    });
    this.logger.debug(`Product ${productId} stock updated to ${newStock}.`);


    // Emitir alerta de stock bajo (fuera de la lógica transaccional crítica si es necesario)
    if (updatedProduct.currentStock <= updatedProduct.minStock && product.currentStock > product.minStock) { // Solo alertar al cruzar el umbral
        this.logger.warn(`LOW STOCK ALERT: Product ${updatedProduct.name} (ID: ${productId}) reached minimum stock level (${updatedProduct.currentStock}/${updatedProduct.minStock})`);
        // TODO: Implementar sistema de notificaciones (email, dashboard, etc.)
    }

      return updatedProduct;
    });
  }
}

