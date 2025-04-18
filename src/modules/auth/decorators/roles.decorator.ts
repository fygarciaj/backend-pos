import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client'; // Importa tu enum de roles

export const ROLES_KEY = 'roles';
/**
 * Decorador para asignar los roles requeridos a un endpoint.
 * Usar junto con RolesGuard.
 * @param roles - Uno o más roles requeridos para acceder al recurso.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
