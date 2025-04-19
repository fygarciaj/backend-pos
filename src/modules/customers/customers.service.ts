import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma, Customer } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const { email, accountBalance, ...customerData } = createCustomerDto;

    // Check unique email if provided
    if (email) {
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Customer with email "${email}" already exists.`,
        );
      }
    }

    const data: Prisma.CustomerCreateInput = {
      ...customerData,
      email,
      accountBalance: accountBalance ? Number(accountBalance) : 0,
    };

    try {
      this.logger.log(`Creating customer: ${data.fullName}`);
      return await this.prisma.customer.create({ data });
    } catch (error) {
      this.handleDbError(error, { email });
    }
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.CustomerWhereUniqueInput;
    where?: Prisma.CustomerWhereInput;
    orderBy?: Prisma.CustomerOrderByWithRelationInput;
  }): Promise<Customer[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.customer.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy: orderBy ?? { fullName: 'asc' },
      include: {
        _count: {
          select: { sales: true },
        },
      },
    });
  }

  async findOne(id: string, includeSales = false): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        sales: includeSales
          ? {
              take: 10,
              orderBy: { saleTimestamp: 'desc' },
              select: {
                id: true,
                saleTimestamp: true,
                totalAmount: true,
                status: true,
              },
            }
          : false,
        _count: {
          select: { sales: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    // Verificar si existe
    await this.findOne(id, false);

    const { email, accountBalance, ...customerData } = updateCustomerDto;
    const dataToUpdate: Prisma.CustomerUpdateInput = { ...customerData };

    // Validar email único si se cambia
    if (email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { email, id: { not: id } },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Customer with email "${email}" already exists.`,
        );
      }
      dataToUpdate.email = email;
    } else if (email === null) {
      // Permitir borrar email
      dataToUpdate.email = null;
    }

    // Convertir Decimal a un número compatible
    if (accountBalance !== undefined) {
      dataToUpdate.accountBalance = parseFloat(accountBalance.toString());
    }

    try {
      this.logger.log(`Updating customer ID: ${id}`);
      return await this.prisma.customer.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch (error) {
      this.handleDbError(error, { email });
    }
  }

  async remove(id: string): Promise<Customer> {
    const customerToDelete = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sales: true },
        },
      },
    });

    if (!customerToDelete) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }

    if (customerToDelete._count.sales > 0) {
      throw new ConflictException(
        `Cannot delete customer "${customerToDelete.fullName}" because they have ${customerToDelete._count.sales} associated sales. Consider deactivating the customer instead.`,
      );
    }

    try {
      this.logger.log(
        `Deleting customer: ${customerToDelete.fullName} (ID: ${id})`,
      );
      return await this.prisma.customer.delete({ where: { id } });
    } catch (error) {
      this.handleDbError(error);
    }
  }

  // Helper para manejar errores de base de datos
  private handleDbError(error: any, context?: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const fields = error.meta?.target as string[];
        if (fields?.includes('email') && context?.email) {
          throw new ConflictException(
            `Customer with email "${context.email}" already exists.`,
          );
        }
        throw new ConflictException('Unique constraint violation.'); // Mensaje genérico si no es email
      }
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundException('The customer record was not found.');
      }
      // P2003 (Foreign key constraint) se maneja con la verificación de ventas
    }
    this.logger.error(`Database Error: ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      'An unexpected database error occurred.',
    );
  }
}
