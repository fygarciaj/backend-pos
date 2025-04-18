import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mockear bcrypt
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mockSalt'),
  hash: jest.fn().mockResolvedValue('mockHashedPassword'),
  compare: jest.fn(),
}));

// Mockear PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // Mockear $transaction si fuera necesario en otros servicios
};

const mockUser: User = {
  id: 'user-uuid-1',
  username: 'testuser',
  password: 'hashedPasswordFromDb',
  fullName: 'Test User Full',
  role: UserRole.CASHIER,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserNoPassword = { ...mockUser };
delete mockUserNoPassword.password;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create ---
  describe('create', () => {
    const createUserDto = {
      username: 'newuser',
      password: 'password123',
      fullName: 'New User',
      role: UserRole.CASHIER,
    };

    it('should create a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // No existing user
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        username: 'newuser',
        fullName: 'New User',
        password: 'mockHashedPassword',
      });

      const result = await service.create(createUserDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'newuser' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'mockSalt');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: 'newuser',
          password: 'mockHashedPassword',
          fullName: 'New User',
          role: UserRole.CASHIER,
          isActive: true, // Default
        },
      });
      expect(result).toEqual(expect.objectContaining({ username: 'newuser' }));
      expect(result.password).toBeUndefined(); // Password should be excluded
    });

    it('should throw ConflictException if username already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser); // User exists

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on Prisma unique constraint error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'x.y.z',
          meta: { target: ['username'] },
        },
      );
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // --- Test findOne ---
  describe('findOne', () => {
    it('should return a user if found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findOne('user-uuid-1');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toEqual(mockUserNoPassword);
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- Test findByUsername ---
  describe('findByUsername', () => {
    it('should return a user with password if found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findByUsername('testuser');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(result).toEqual(mockUser); // Should include password
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findByUsername('nonexistentuser');
      expect(result).toBeNull();
    });
  });

  // --- Test update ---
  describe('update', () => {
    const updateDto = { fullName: 'Updated Name', password: 'newPassword123' };

    it('should update a user successfully', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser); // For findOne check
      prisma.user.findFirst.mockResolvedValue(null); // No conflict with username
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        fullName: 'Updated Name',
        password: 'newHashedPassword',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword'); // Mock new hash

      const result = await service.update('user-uuid-1', updateDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 'mockSalt');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { fullName: 'Updated Name', password: 'newHashedPassword' },
      });
      expect(result.fullName).toBe('Updated Name');
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException if user to update not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // findOne check fails
      await expect(
        service.update('non-existent-uuid', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updated username is taken', async () => {
      const updateWithUsernameDto = { username: 'anotherUser' };
      prisma.user.findUnique.mockResolvedValueOnce(mockUser); // findOne check passes
      prisma.user.findFirst.mockResolvedValue({
        id: 'other-uuid',
        username: 'anotherUser',
        password: 'pwd',
        fullName: 'Other',
        role: UserRole.CASHIER,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }); // Username conflict found

      await expect(
        service.update('user-uuid-1', updateWithUsernameDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- Test remove ---
  describe('remove', () => {
    it('should remove a user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser); // findOne check
      prisma.user.delete.mockResolvedValue(mockUser);

      const result = await service.remove('user-uuid-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result).toEqual(mockUserNoPassword);
    });

    it('should throw NotFoundException if user to remove not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // findOne check fails
      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on Prisma foreign key constraint error', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'x.y.z' },
      );
      prisma.user.delete.mockRejectedValue(prismaError);

      await expect(service.remove('user-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
