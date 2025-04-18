import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Decorador para marcar un endpoint como público (no requiere autenticación JWT).
 * Usar junto con JwtAuthGuard global o específico.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
