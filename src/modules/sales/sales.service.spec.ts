import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from '../products/products.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  Sale,
  SaleDetail,
  Product,
  Customer,
  InventoryMovementType,
  SaleStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateSaleDto } from './dto/create-sale.dto';

// Mock ProductsService
const mockProductsService = {
  findOne: jest.fn(), // Mock findOne used implicitly by updateStock
  updateStock: jest.fn(),
  // Mock other methods if needed
};

// Mock PrismaService (including transaction)
const mockPrismaService = {
  sale: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  saleDetail: {
    // Methods if needed directly
  },
  product: {
    findUnique: jest.fn(), // Used within transaction
    // update: jest.fn(), // updateStock handles this
  },
  customer: {
    findUnique: jest.fn(), // Used within transaction
  },
  inventoryMovement: {
    // create: jest.fn(), // updateStock handles this
  },
  $transaction: jest.fn().mockImplementation(async (callback) => {
    const mockTxClient = {
      // Mock client passed to callback
      sale: {
        create: mockPrismaService.sale.create,
        findUnique: mockPrismaService.sale.findUnique, // Needed for final fetch
        // ... other sale methods if used in tx ...
      },
      product: {
        findUnique: mockPrismaService.product.findUnique,
      },
      customer: {
        findUnique: mockPrismaService.customer.findUnique,
      },
      // updateStock is called on the *service*, passing mockTxClient
    };
    // Simulate successful transaction by default
    try {
      const result = await callback(mockTxClient);
      // Mock the final fetch outside the main tx logic if needed
      if (mockPrismaService.sale.findUnique.mock.calls.length > 0) {
        // If findUnique was called after create
        return mockPrismaService.sale.findUnique.mock.results[
          mockPrismaService.sale.findUnique.mock.calls.length - 1
        ].value;
      }
      return result; // Or return the direct result of create if no final fetch mock
    } catch (error) {
      // Simulate rollback by re-throwing
      throw error;
    }
  }),
};

const mockProduct1: Product = {
  id: 'prod-1',
  name: 'P1',
  currentStock: 10,
  sellingPrice: new Decimal('10.00'),
  isActive: true,
  costPrice: new Decimal(5),
  categoryId: 'c1',
  brandId: 'b1',
  unitOfMeasure: 'u',
  minStock: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  barcode: null,
  description: null,
  dimensions: null,
  isFeatured: null,
  locationId: null,
  maxStock: null,
  promotionId: null,
  promotionIsActive: null,
  sku: null,
  tags: null,
  variants: null,
  weight: null,
};
const mockProduct2: Product = {
  id: 'prod-2',
  name: 'P2',
  currentStock: 5,
  sellingPrice: new Decimal('25.50'),
  isActive: true,
  costPrice: new Decimal(15),
  categoryId: 'c1',
  brandId: 'b1',
  unitOfMeasure: 'u',
  minStock: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  barcode: null,
  description: null,
  dimensions: null,
  isFeatured: null,
  locationId: null,
  maxStock: null,
  promotionId: null,
  promotionIsActive: null,
  sku: null,
  tags: null,
  variants: null,
  weight: null,
};
const mockCustomer: Customer = {
  id: 'cust-1',
  fullName: 'Cust Name',
  email: 'c@e.com',
  isActive: true,
  accountBalance: new Decimal(0),
  address: null,
  customerType: null,
  loyaltyPoints: 0,
  phone: null,
  registeredAt: new Date(),
  updatedAt: new Date(),
};
const mockSaleResult = {
  id: 'sale-1',
  total: new Decimal('61.00'),
  /* ... other fields ... */ user: {},
  customer: {},
  saleDetails: [],
}; // Mock a full sale result

describe('SalesService', () => {
  let service: SalesService;
  let prisma: typeof mockPrismaService;
  let productsService: typeof mockProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    prisma = module.get(PrismaService);
    productsService = module.get(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create ---
  describe('create', () => {
    const userId = 'user-1';
    const createDto: CreateSaleDto = {
      paymentMethod: 'cash',
      items: [
        { productId: 'prod-1', quantity: 2 }, // Total 20.00
        { productId: 'prod-2', quantity: 1 }, // Total 25.50
      ],
      // Subtotal = 45.50
    };
    const createDtoWithCustomer: CreateSaleDto = {
      ...createDto,
      customerId: 'cust-1',
    };

    beforeEach(() => {
      // Mock successful transaction steps by default
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.product.findUnique
        .mockResolvedValueOnce(mockProduct1) // First item lookup
        .mockResolvedValueOnce(mockProduct2); // Second item lookup
      prisma.sale.create.mockResolvedValue({
        id: 'sale-1',
        /* ... other necessary fields ... */ saleDetails: [],
      }); // Mock create result
      productsService.updateStock.mockResolvedValue({} as Product); // Mock stock update success
      // Mock the final fetch call made by create
      prisma.sale.findUnique.mockResolvedValue(mockSaleResult);
    });

    it('should create a sale, details, update stock, and return the sale', async () => {
      const result = await service.create(createDto, userId);

      // Check transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();

      // Check lookups within transaction mock context
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-2' },
      });

      // Check sale creation data
      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: userId,
            subtotal: new Decimal('45.50'), // 2*10.00 + 1*25.50
            total: new Decimal('45.50'), // Assuming no tax/discount for simplicity
            saleDetails: {
              createMany: {
                data: [
                  expect.objectContaining({
                    productId: 'prod-1',
                    quantity: 2,
                    unitPrice: new Decimal('10.00'),
                    total: new Decimal('20.00'),
                  }),
                  expect.objectContaining({
                    productId: 'prod-2',
                    quantity: 1,
                    unitPrice: new Decimal('25.50'),
                    total: new Decimal('25.50'),
                  }),
                ],
              },
            },
          }),
        }),
      );

      // Check stock updates
      expect(productsService.updateStock).toHaveBeenCalledTimes(2);
      expect(productsService.updateStock).toHaveBeenCalledWith(
        'prod-1',
        -2,
        InventoryMovementType.OUT_SALE,
        userId,
        undefined,
        'sale-1',
        undefined,
        undefined,
        expect.anything(), // Check tx client passed
      );
      expect(productsService.updateStock).toHaveBeenCalledWith(
        'prod-2',
        -1,
        InventoryMovementType.OUT_SALE,
        userId,
        undefined,
        'sale-1',
        undefined,
        undefined,
        expect.anything(), // Check tx client passed
      );

      // Check final fetch
      expect(prisma.sale.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sale-1' } }),
      );

      // Check result
      expect(result).toEqual(mockSaleResult);
    });

    it('should handle customer association', async () => {
      await service.create(createDtoWithCustomer, userId);
      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
      });
      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException if customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create(createDtoWithCustomer, userId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).toHaveBeenCalled(); // Transaction starts but fails
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null); // Simulate product not found
      await expect(service.create(createDto, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if stock is insufficient', async () => {
      const lowStockProduct = { ...mockProduct1, currentStock: 1 };
      prisma.product.findUnique.mockResolvedValueOnce(lowStockProduct); // Product with low stock
      await expect(service.create(createDto, userId)).rejects.toThrow(
        ConflictException,
      ); // DTO asks for 2
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if product is inactive', async () => {
      const inactiveProduct = { ...mockProduct1, isActive: false };
      prisma.product.findUnique.mockResolvedValueOnce(inactiveProduct);
      await expect(service.create(createDto, userId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    // Add tests for discount/tax calculations if implemented
  });

  // Add tests for findOne, findAll, update (especially cancellation logic)...
});
