import {
  PrismaClient,
  UserRole,
  MovementType,
  SaleStatus,
} from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Seed Users for Each Role
  const roles = [
    {
      username: 'admin_user',
      fullName: 'Admin User',
      role: 'ADMIN' as UserRole,
    },
    {
      username: 'manager_user',
      fullName: 'Manager User',
      role: 'MANAGER' as UserRole,
    },
    {
      username: 'cashier_user',
      fullName: 'Cashier User',
      role: 'CASHIER' as UserRole,
    },
    {
      username: 'inventory_user',
      fullName: 'Inventory Manager',
      role: 'INVENTORY_MANAGER' as UserRole,
    },
    {
      username: 'reports_user',
      fullName: 'Reports Viewer',
      role: 'REPORTS_VIEWER' as UserRole,
    },
  ];

  for (const roleData of roles) {
    await prisma.user.upsert({
      where: { username: roleData.username },
      update: {},
      create: {
        username: roleData.username,
        passwordHash: 'hashed_password', // Replace with a real hashed password
        fullName: roleData.fullName,
        role: roleData.role,
        isActive: true,
      },
    });
  }

  // Seed Categories
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and gadgets' },
    { name: 'Clothing', description: 'Apparel and garments' },
    { name: 'Food & Beverages', description: 'Consumable products' },
    {
      name: 'Home & Garden',
      description: 'Home improvement and garden supplies',
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
    });
  }

  // Seed Brands
  const brands = [
    { name: 'Apple' },
    { name: 'Samsung' },
    { name: 'Nike' },
    { name: 'Sony' },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { name: brand.name },
      update: {},
      create: {
        name: brand.name,
        isActive: true,
      },
    });
  }

  // Fetch created categories and brands for reference
  const electronicsCategory = await prisma.category.findUnique({
    where: { name: 'Electronics' },
  });
  const clothingCategory = await prisma.category.findUnique({
    where: { name: 'Clothing' },
  });
  const appleBrand = await prisma.brand.findUnique({
    where: { name: 'Apple' },
  });
  const samsungBrand = await prisma.brand.findUnique({
    where: { name: 'Samsung' },
  });
  const nikeBrand = await prisma.brand.findUnique({ where: { name: 'Nike' } });
  const sonyBrand = await prisma.brand.findUnique({ where: { name: 'Sony' } });

  if (
    !electronicsCategory ||
    !clothingCategory ||
    !appleBrand ||
    !samsungBrand ||
    !nikeBrand ||
    !sonyBrand
  ) {
    throw new Error('Required categories or brands not found');
  }

  // Seed Products
  const products = [
    {
      name: 'iPhone 13',
      description: 'Latest Apple smartphone',
      sku: 'iphone-13',
      categoryId: electronicsCategory.id,
      brandId: appleBrand.id,
      costPrice: 699,
      sellingPrice: 999,
      currentStock: 50,
    },
    {
      name: 'Samsung Galaxy S21',
      description: 'High-end Android smartphone',
      sku: 'samsung-s21',
      categoryId: electronicsCategory.id,
      brandId: samsungBrand.id,
      costPrice: 699,
      sellingPrice: 899,
      currentStock: 40,
    },
    {
      name: 'Nike Air Max',
      description: 'Premium running shoes',
      sku: 'nike-airmax',
      categoryId: clothingCategory.id,
      brandId: nikeBrand.id,
      costPrice: 89,
      sellingPrice: 129,
      currentStock: 100,
    },
    {
      name: 'Sony WH-1000XM4',
      description: 'Noise cancelling headphones',
      sku: 'sony-wh1000xm4',
      categoryId: electronicsCategory.id,
      brandId: sonyBrand.id,
      costPrice: 249,
      sellingPrice: 349,
      currentStock: 30,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        ...product,
        isActive: true,
        unitOfMeasure: 'unit',
      },
    });
  }

  // Seed Store Configuration
  await prisma.storeConfig.upsert({
    where: { id: 'main-config' },
    update: {},
    create: {
      id: 'main-config',
      storeName: 'Mi Tienda POS',
      address: 'Calle Principal #123',
      taxInfo: 'RFC: XAXX010101000',
      currencyCode: 'MXN',
      taxConfig: {
        IVA: 16,
        IEPS: 8,
      },
      discountConfig: {
        maxDiscount: 25,
        defaultDiscount: 10,
      },
      unitsOfMeasure: ['unit', 'kg', 'lt', 'box'],
      activePaymentMethods: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER'],
    },
  });

  // Seed Locations
  const locations = [
    {
      name: 'Main Warehouse',
      type: 'WAREHOUSE',
      description: 'Main storage facility',
      capacity: 1000,
    },
    {
      name: 'Store Front',
      type: 'SALES_FLOOR',
      description: 'Main retail area',
      capacity: 200,
    },
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { name: location.name },
      update: {},
      create: {
        ...location,
        isActive: true,
      },
    });
  }

  // Seed Customers
  const customers = [
    {
      fullName: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '555-1234',
      customerType: 'REGULAR',
      loyaltyPoints: 100,
    },
    {
      fullName: 'Jane Smith',
      email: 'jane@example.com',
      phoneNumber: '555-5678',
      customerType: 'WHOLESALE',
      loyaltyPoints: 500,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { email: customer.email },
      update: {},
      create: {
        ...customer,
        isActive: true,
        registrationDate: new Date(),
        accountBalance: 0,
      },
    });
  }

  // Create a sale with its details
  const adminUser = await prisma.user.findUnique({
    where: { username: 'admin_user' },
  });
  const customer = await prisma.customer.findUnique({
    where: { email: 'john@example.com' },
  });
  const product = await prisma.product.findUnique({
    where: { sku: 'iphone-13' },
  });

  if (adminUser && customer && product) {
    const sale = await prisma.sale.create({
      data: {
        userId: adminUser.id,
        customerId: customer.id,
        status: 'COMPLETED' as SaleStatus,
        subtotal: 999,
        totalAmount: 1158.84,
        taxDetails: { IVA: 159.84 },
        paymentMethod: 'CREDIT_CARD',
        saleDetails: {
          create: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: product.sellingPrice,
              itemSubtotal: product.sellingPrice,
              itemTotal: product.sellingPrice * 1.16, // Including 16% tax
            },
          ],
        },
      },
      include: {
        saleDetails: true,
      },
    });

    // Create inventory movement for the sale
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        movementType: 'SALE_EXIT' as MovementType,
        quantity: -1,
        userId: adminUser.id,
      },
    });

    // Create purchase orders
    const supplier = await prisma.supplier.upsert({
      where: { name: 'Tech Wholesale Inc' },
      update: {},
      create: {
        name: 'Tech Wholesale Inc',
        email: 'sales@techwholesale.com',
        phoneNumber: '555-9999',
        contactPerson: 'Mike Wilson',
        paymentTerms: 'Net 30',
        isActive: true,
      },
    });

    if (adminUser && product) {
      // Create a purchase order
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          status: 'PENDING',
          totalAmount: 3495,
          createdByUserId: adminUser.id, // Added the required field
          items: {
            create: [
              {
                productId: product.id,
                quantityOrdered: 5,
                unitCostPrice: 699,
              },
            ],
          },
        },
        include: {
          items: true,
        },
      });

      // Create inventory movements for purchase order
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          movementType: 'PURCHASE_ENTRY' as MovementType,
          quantity: 5,
          userId: adminUser.id,
          purchaseOrderId: purchaseOrder.id,
        },
      });

      // Create a return for the previous sale
      if (sale && sale.saleDetails[0]) {
        await prisma.return.create({
          data: {
            originalSaleId: sale.id,
            processedByUserId: adminUser.id,
            returnedItems: [
              {
                productId: sale.saleDetails[0].productId,
                quantity: 1,
              },
            ],
            reason: 'Defective product',
            refundedAmount: sale.saleDetails[0].itemTotal,
          },
        });

        // Create inventory movement for the return
        await prisma.inventoryMovement.create({
          data: {
            productId: sale.saleDetails[0].productId,
            movementType: 'CUSTOMER_RETURN' as MovementType,
            quantity: 1,
            userId: adminUser.id,
            adjustmentReason: 'Customer return - defective product',
          },
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
