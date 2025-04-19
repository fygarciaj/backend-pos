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

    // Verificar email único si se proporciona
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
      accountBalance: accountBalance
        ? new Decimal(accountBalance)
        : new Decimal('0.00'),
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
        _count: { select: { sales: true } }, // Incluir contador de ventas
      },
    });
  }

  async findOne(
    id: string,
    includeSales: boolean = false,
  ): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        sales: includeSales
          ? {
              take: 10, // Limitar número de ventas incluidas
              orderBy: { createdAt: 'desc' },
              select: { id: true, saleDate: true, total: true, status: true }, // Seleccionar campos clave de la venta
            }
          : false,
        _count: { select: { sales: true } },
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
    // Verificar si existe
    const customerToDelete = await this.findOne(id, true); // Incluir relaciones para verificar

    // Verificar si tiene ventas asociadas
    // En lugar de impedir borrar, podríamos anonimizar o marcar como inactivo.
    // Por ahora, impedimos si tiene ventas.
    if (
      customerToDelete &&
      customerToDelete._count &&
      customerToDelete._count.sales > 0
    ) {
      throw new ConflictException(
        `Cannot delete customer "${customerToDelete.fullName}" because they have ${customerToDelete._count.sales} associated sales. Consider deactivating the customer instead.`,
      );
      // Alternativa: Marcar como inactivo
      // return this.update(id, { isActive: false });
    }

    try {
      this.logger.log(
        `Deleting customer: ${customerToDelete.fullName} (ID: ${id})`,
      );
      return await this.prisma.customer.delete({
        where: { id },
      });
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
