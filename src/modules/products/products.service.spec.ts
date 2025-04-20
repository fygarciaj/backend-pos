import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Product } from '@prisma/client'; // Corrected import
import Decimal from 'decimal.js'; // Import Decimal if needed for mock data
import { CreateProductDto } from './dto/create-product.dto';
// Removed unused import for UpdateProductDto

// Mock PrismaService
const mockPrismaService = {
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
  },
  // Mock $transaction
  $transaction: jest
    .fn()
    .mockImplementation(
      async <T>(
        callback: (txClient: typeof mockPrismaService) => Promise<T>,
      ): Promise<T> => {
        // Simulate transaction by calling the callback with a mock transaction client
        // The mock client should mirror the methods used within the transaction
        const mockTxClient = {
          product: {
            findUnique: mockPrismaService.product.findUnique,
            findMany: mockPrismaService.product.findMany,
            create: mockPrismaService.product.create,
            update: mockPrismaService.product.update,
            delete: mockPrismaService.product.delete,
            count: mockPrismaService.product.count,
          },
          inventoryMovement: {
            create: mockPrismaService.inventoryMovement.create,
          },
          $transaction: mockPrismaService.$transaction,
        };
        return await callback(mockTxClient);
      },
    ),
};

const mockProduct: Product = {
  id: 'product-id',
  name: 'Test Product',
  description: 'Test Description',
  barcode: '123456789',
  currentStock: 100,
  minimumStock: 10,
  maximumStock: 200,
  categoryId: 'category-id',
  brandId: 'brand-id',
  costPrice: (() => {
    try {
      return new Decimal('10.00').toNumber(); // Convert Decimal to number
    } catch (error) {
      console.error(
        'Error constructing Decimal or converting to number:',
        error,
      );
      return 0; // Fallback to a default value
    }
  })(),
  createdAt: new Date(),
  updatedAt: new Date(),
  variants: {}, // Mock variants as an empty object
  images: [], // Add mock images as an empty array
  unitOfMeasure: 'kg', // Add a mock unit of measure
  isActive: true, // Add a mock isActive flag
  isFeatured: false, // Add a mock isFeatured flag
  tags: '', // Add mock tags as an empty string
  isPromotionActive: false, // Add a mock isPromotionActive flag
  promotionId: null, // Add a mock promotionId
  weight: null, // Add a mock weight
  dimensions: null, // Add a mock dimensions
  sku: 'test-sku', // Add a mock SKU
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create ---
  describe('create', () => {
    const createDto: CreateProductDto = {
      name: 'New Prod',
      unitOfMeasure: 'kg',
      costPrice: '15.50',
      sellingPrice: '30.00',
      categoryId: 'cat-uuid-1',
      brandId: 'brand-uuid-1',
      // ... other fields
    };

    it('should create a product', async () => {
      prisma.product.create.mockResolvedValue({
        ...mockProduct,
        name: 'New Prod',
      });
      const result = await service.create(createDto);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Prod',
            costPrice: new Decimal('15.50'),
            sellingPrice: new Decimal('30.00'),
            category: { connect: { id: 'cat-uuid-1' } },
            brand: { connect: { id: 'brand-uuid-1' } },
          }),
        }),
      );
      expect(result.name).toBe('New Prod');
    });
    // Add tests for image creation if included in DTO
  });

  // --- Test findOne ---
  describe('findOne', () => {
    it('should find a product by id', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      const result = await service.findOne('prod-uuid-1');
      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-uuid-1' } }),
      );
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- Test updateStock ---
  describe('updateStock', () => {
    const productId = 'prod-uuid-1';
    const userId = 'user-uuid-1';

    it('should decrease stock and create movement for OUT_SALE', async () => {
      const quantityChange = -2;
      const initialStock = 10;
      const expectedNewStock = 8;
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        currentStock: initialStock,
      });
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        currentStock: expectedNewStock,
      });

      const result = await service.updateStock(
        productId,
        quantityChange,
        InventoryMovementType.OUT_SALE,
        userId,
      );

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          productId,
          quantity: quantityChange,
          type: InventoryMovementType.OUT_SALE,
          userId,
          reason: undefined,
          relatedSaleId: undefined,
          relatedPurchaseOrderId: undefined,
          relatedReturnId: undefined,
        },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { currentStock: expectedNewStock },
      });
      expect(result.currentStock).toBe(expectedNewStock);
    });

    it('should increase stock and create movement for IN_PURCHASE', async () => {
      const quantityChange = 5;
      const initialStock = 10;
      const expectedNewStock = 15;
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        currentStock: initialStock,
      });
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        currentStock: expectedNewStock,
      });

      const result = await service.updateStock(
        productId,
        quantityChange,
        InventoryMovementType.IN_PURCHASE,
        userId,
      );

      expect(prisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: quantityChange,
            type: InventoryMovementType.IN_PURCHASE,
          }),
        }),
      );
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStock: expectedNewStock } }),
      );
      expect(result.currentStock).toBe(expectedNewStock);
    });

    it('should throw ConflictException if stock is insufficient for OUT_SALE', async () => {
      const quantityChange = -15; // More than available
      const initialStock = 10;
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        currentStock: initialStock,
      });

      await expect(
        service.updateStock(
          productId,
          quantityChange,
          InventoryMovementType.OUT_SALE,
          userId,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('should use transaction client if provided', async () => {
      const quantityChange = -1;
      const mockTx = {
        // Mock transaction client passed to $transaction callback
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          update: jest
            .fn()
            .mockResolvedValue({ ...mockProduct, currentStock: 9 }),
        },
        inventoryMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      await service.updateStock(
        productId,
        quantityChange,
        InventoryMovementType.OUT_SALE,
        userId,
        undefined,
        undefined,
        undefined,
        undefined,
        mockTx as any,
      );

      // Verify methods were called on the mockTx object, NOT on prisma directly
      expect(mockTx.product.findUnique).toHaveBeenCalled();
      expect(mockTx.inventoryMovement.create).toHaveBeenCalled();
      expect(mockTx.product.update).toHaveBeenCalled();
      expect(prisma.product.findUnique).not.toHaveBeenCalled(); // Ensure original prisma methods weren't called
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    // Add test for low stock warning log
  });

  // Add tests for update, remove, findByBarcode, searchByName...
});
