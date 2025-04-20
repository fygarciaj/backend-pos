import { Prisma } from '@prisma/client';
import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginResponse } from './interfaces/login-response.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in a user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token.',
    type: Object,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid credentials.',
  })
  async login(
    @Request()
    req: {
      user: Omit<
        {
          id: string;
          username: string;
          passwordHash: string;
          fullName: string;
          role: UserRole;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
        },
        'password'
      >;
    },
  ): Promise<LoginResponse> {
    return this.authService.login(
      req.user as Omit<
        {
          id: string;
          username: string;
          passwordHash: string;
          fullName: string;
          role: UserRole;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
          lastLogin: Date | null;
        },
        'password'
      >,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the authenticated user profile.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Token missing or invalid.',
  })
  getProfile(@Request() req: { user: any }): any {
    return req.user;
  }
}
