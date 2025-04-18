import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener los roles requeridos definidos con @Roles() en el handler o la clase
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no se definieron roles requeridos, permitir el acceso (JwtAuthGuard ya hizo su trabajo)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener el objeto 'user' adjuntado por JwtAuthGuard/JwtStrategy
    const { user } = context.switchToHttp().getRequest();

    // Si no hay usuario adjunto (esto no debería pasar si JwtAuthGuard se ejecutó antes), denegar
    if (!user || !user.roles) {
      // console.error('RolesGuard Error: User object or user.roles not found on request. Ensure JwtAuthGuard runs first and attaches roles.');
      throw new ForbiddenException(
        'User information is missing for role check.',
      );
    }

    // Verificar si el usuario tiene al menos uno de los roles requeridos
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles?.includes(role),
    );

    if (!hasRequiredRole) {
      // console.log(`RolesGuard Denied: User roles ${user.roles} do not include required roles ${requiredRoles}`);
      throw new ForbiddenException(
        `You do not have the necessary permissions (${requiredRoles.join(', ')}) to access this resource.`,
      );
    }

    // console.log(`RolesGuard Allowed: User roles ${user.roles} include at least one of required roles ${requiredRoles}`);
    return true; // Permitir acceso si tiene el rol
  }
}
