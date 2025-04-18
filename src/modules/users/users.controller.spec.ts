import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

// Mock UsersService
const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockUserResult = {
  id: 'user-uuid-1',
  username: 'testuser',
  // No password in controller results
  fullName: 'Test User Full',
  role: UserRole.CASHIER,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let service: typeof mockUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      // Mock Guards if applied directly to controller/methods
      // .overrideGuard(RolesGuard).useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- Test POST /users ---
  describe('create', () => {
    it('should call usersService.create and return the result', async () => {
      const createDto: CreateUserDto = {
        username: 'new',
        password: 'pwd',
        fullName: 'New',
      };
      mockUsersService.create.mockResolvedValue(mockUserResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockUserResult);
    });
  });

  // --- Test GET /users ---
  describe('findAll', () => {
    it('should call usersService.findAll and return the result', async () => {
      const usersArray = [mockUserResult];
      mockUsersService.findAll.mockResolvedValue(usersArray);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(usersArray);
    });
  });

  // --- Test GET /users/:id ---
  describe('findOne', () => {
    it('should call usersService.findOne with id and return the result', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUserResult);

      const result = await controller.findOne('user-uuid-1');

      expect(service.findOne).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockUserResult);
    });

    it('should propagate NotFoundException from service', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException());
      await expect(controller.findOne('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- Test PATCH /users/:id ---
  describe('update', () => {
    it('should call usersService.update with id and dto, and return the result', async () => {
      const updateDto: UpdateUserDto = { fullName: 'Updated' };
      const updatedUser = { ...mockUserResult, fullName: 'Updated' };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-uuid-1', updateDto);

      expect(service.update).toHaveBeenCalledWith('user-uuid-1', updateDto);
      expect(result).toEqual(updatedUser);
    });
  });

  // --- Test DELETE /users/:id ---
  describe('remove', () => {
    it('should call usersService.remove with id and return the result', async () => {
      mockUsersService.remove.mockResolvedValue(mockUserResult);

      const result = await controller.remove('user-uuid-1');

      expect(service.remove).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(mockUserResult);
    });
  });
});
