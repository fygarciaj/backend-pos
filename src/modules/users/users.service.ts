import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // Número de rondas de salting (recomendado >= 10)
    return bcrypt.hash(password, saltRounds);
  }

  async create(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const { password, ...userData } = createUserDto;

    const hashedPassword = await this.hashPassword(password);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          passwordHash: hashedPassword,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user; // Excluir hash de la respuesta
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation
          throw new ConflictException(
            `Username '${userData.username}' already exists.`,
          );
        }
      }
      throw new InternalServerErrorException('Could not create user.');
    }
  }

  async findAll(
    pagination: { page: number; limit: number },
    filters: { role?: string },
  ): Promise<{ data: Omit<User, 'passwordHash'>[]; count: number }> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

    if (
      filters.role &&
      Object.values(UserRole).includes(filters.role as UserRole)
    ) {
      where.role = filters.role as UserRole;
    }
    // Añadir más filtros aquí si es necesario (e.g., isActive)
    // where.isActive = true;

    try {
      const [users, count] = await this.prisma.$transaction([
        this.prisma.user.findMany({
          skip,
          take: limit,
          where,
          select: {
            // Seleccionar explícitamente para excluir passwordHash
            id: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: 'desc', // O por username, etc.
          },
        }),
        this.prisma.user.count({ where }),
      ]);
      return { data: users, count };
    } catch (error) {
      // Log error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Could not retrieve users. ${errorMessage}`,
      );
    }
  }

  async findOne(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        // Excluir hash
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user;
  }

  // Método para buscar por username (usado por AuthService)
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const { password, ...userData } = updateUserDto;
    const dataToUpdate: Prisma.UserUpdateInput = { ...userData };

    if (password) {
      dataToUpdate.passwordHash = await this.hashPassword(password);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: dataToUpdate,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = updatedUser;
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Username '${userData.username}' already exists.`,
          );
        }
        if (error.code === 'P2025') {
          // Record to update not found
          throw new NotFoundException(`User with ID "${id}" not found.`);
        }
      }
      throw new InternalServerErrorException('Could not update user.');
    }
  }

  async remove(id: string): Promise<Omit<User, 'passwordHash'>> {
    // Considerar borrado lógico:
    // return this.update(id, { isActive: false });

    try {
      const user = await this.prisma.user.delete({
        where: { id },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record to delete does not exist
          throw new NotFoundException(`User with ID "${id}" not found.`);
        }
        // Podría haber error P2003 si el usuario tiene registros relacionados (ventas, etc.)
        // que impiden el borrado. Manejar según la lógica de negocio.
        if (error.code === 'P2003') {
          throw new ConflictException(
            `Cannot delete user with ID "${id}" due to existing related records (e.g., sales, inventory movements). Consider deactivating the user instead.`,
          );
        }
      }
      throw new InternalServerErrorException('Could not delete user.');
    }
  }
}
