import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, Product, MovementType } from '@prisma/client';

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

    const productCreateInput: Prisma.ProductCreateInput = {
      ...productData,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      weight: weight !== undefined ? Number(weight) : null,
      category: { connect: { id: categoryId } },
      ...(brandId && { brand: { connect: { id: brandId } } }),
      images: images
        ? images.length > 0
          ? images.map((img) => img.url)
          : []
        : [],
    };

    return this.prisma.product.create({
      data: productCreateInput,
      include: { category: true, brand: true },
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
      include: { category: true, brand: true },
    });
  }

  async findOne(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, brand: true },
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
    await this.findOne(id);
    const {
      images,
      categoryId,
      brandId,
      costPrice,
      sellingPrice,
      weight,
      ...productData
    } = updateProductDto;
    const dataToUpdate: Prisma.ProductUpdateInput = { ...productData };
    if (costPrice !== undefined) dataToUpdate.costPrice = Number(costPrice);
    if (sellingPrice !== undefined)
      dataToUpdate.sellingPrice = Number(sellingPrice);
    if (weight !== undefined) dataToUpdate.weight = Number(weight);
    if (categoryId) dataToUpdate.category = { connect: { id: categoryId } };
    if (brandId) dataToUpdate.brand = { connect: { id: brandId } };
    if (updateProductDto.locationId !== undefined) {
      // La relación de ubicación es a través de ProductLocation, no directamente en Product
      // Aquí podrías manejar la lógica de asignación de ubicación si es necesario
    }
    if (images) {
      dataToUpdate.images =
        images.length > 0 ? images.map((img) => img.url) : [];
    }
    return this.prisma.product.update({
      where: { id },
      data: dataToUpdate,
      include: { category: true, brand: true },
    });
  }

  async remove(id: string): Promise<Product> {
    await this.findOne(id);
    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Product with ID "${id}" not found`);
        }
        throw new ConflictException(
          `Could not delete product due to dependencies or other error.`,
        );
      }
      throw error;
    }
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true, brand: true },
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
          { name: { contains: term } },
          { description: { contains: term } },
          { tags: { contains: term } },
        ],
        isActive: true,
      },
      include: { category: true, brand: true },
      take: 20,
    });
  }

  async updateStock(
    productId: string,
    quantityChange: number,
    movementType: MovementType,
    userId?: string,
    reason?: string,
    relatedSaleId?: string,
    relatedPurchaseOrderId?: string,
    relatedReturnId?: string,
    tx?: Omit<
      PrismaService,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
  ): Promise<Product> {
    const prismaClient = tx || this.prisma;
    this.logger.debug(
      `updateStock called for product ${productId}, change ${quantityChange}, type ${movementType}. Using ${tx ? 'transaction client' : 'default client'}.`,
    );
    const product = await prismaClient.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID "${productId}" not found for stock update.`,
      );
    }
    const newStock = product.currentStock + quantityChange;
    if (
      newStock < 0 &&
      (movementType === 'SALE_EXIT' || movementType === 'NEGATIVE_ADJUSTMENT')
    ) {
      this.logger.error(
        `Insufficient stock for product ${product.name} (ID: ${productId}). Required: ${Math.abs(quantityChange)}, Available: ${product.currentStock}`,
      );
      throw new ConflictException(
        `Insufficient stock for product ${product.name} (ID: ${productId}). Required: ${Math.abs(quantityChange)}, Available: ${product.currentStock}`,
      );
    }
    await prismaClient.inventoryMovement.create({
      data: {
        productId: productId,
        quantity: quantityChange,
        movementType: movementType,
        userId: userId!,
        adjustmentReason: reason,
        saleId: relatedSaleId,
        purchaseOrderId: relatedPurchaseOrderId,
        returnId: relatedReturnId,
      },
    });
    this.logger.debug(`Inventory movement created for product ${productId}.`);
    const updatedProduct = await prismaClient.product.update({
      where: { id: productId },
      data: { currentStock: newStock },
    });
    this.logger.debug(`Product ${productId} stock updated to ${newStock}.`);
    if (
      updatedProduct.currentStock <= (updatedProduct.minimumStock ?? 0) &&
      product.currentStock > (product.minimumStock ?? 0)
    ) {
      this.logger.warn(
        `LOW STOCK ALERT: Product ${updatedProduct.name} (ID: ${productId}) reached minimum stock level (${updatedProduct.currentStock}/${updatedProduct.minimumStock})`,
      );
      // TODO: Implement notification system
    }
    return updatedProduct;
  }
}
