import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

// Mock UsersService
const mockUsersService = {
  findByUsername: jest.fn(),
  update: jest.fn(), // For lastLogin update
  // No need to mock create, findOne etc. unless used directly here
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockUser: User = {
  id: 'user-uuid-1',
  username: 'testuser',
  passwordHash: 'hashedPasswordFromDb',
  fullName: 'Test User Full',
  role: UserRole.CASHIER,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const { ...mockUserNoPassword } = mockUser;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: typeof mockUsersService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test validateUser ---
  describe('validateUser', () => {
    it('should return user data (without password) if credentials are valid and user is active', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // Password matches

      const result = await service.validateUser('testuser', 'password123');

      expect(usersService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedPasswordFromDb',
      );
      expect(result).toEqual(mockUserNoPassword);
    });

    it('should return null if user not found', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      const result = await service.validateUser('unknownuser', 'password123');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null if password does not match', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Password mismatch

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByUsername.mockResolvedValue(inactiveUser);

      await expect(
        service.validateUser('testuser', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled(); // Should fail before comparing password
    });
  });

  // --- Test login ---
  describe('login', () => {
    it('should return an access token for a valid user', async () => {
      const mockToken = 'mockAccessToken';
      jwtService.sign.mockReturnValue(mockToken);
      usersService.update.mockResolvedValue({}); // Mock lastLogin update

      const result = await service.login(mockUserNoPassword); // Pass user without password

      const expectedPayload = {
        username: mockUser.username,
        sub: mockUser.id,
        roles: [mockUser.role],
      };
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(usersService.update).toHaveBeenCalledWith(mockUser.id, {
        lastLogin: expect.any(Date) as Date,
      });
      expect(result).toEqual({ access_token: mockToken });
    });

    it('should still return token even if lastLogin update fails', async () => {
      const mockToken = 'mockAccessToken';
      jwtService.sign.mockReturnValue(mockToken);
      usersService.update.mockRejectedValue(new Error('DB error')); // Simulate update failure

      // Use console spy to check for error logging if needed
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.login(mockUserNoPassword);

      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({ access_token: mockToken });
      expect(consoleErrorSpy).toHaveBeenCalled(); // Check if error was logged

      consoleErrorSpy.mockRestore();
    });
  });

  // --- Test verifyToken ---
  describe('verifyToken', () => {
    const token = 'valid.jwt.token';
    const payload = { username: 'user', sub: 'id', roles: [UserRole.CASHIER] };

    it('should return payload if token is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue(payload);
      const result = await service.verifyToken(token);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
