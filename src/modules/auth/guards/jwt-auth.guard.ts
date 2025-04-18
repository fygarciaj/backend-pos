import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'; // Importar la clave del decorador
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { // Usa la estrategia 'jwt' registrada
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Verificar si la ruta está marcada como pública usando el decorador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Verificar metadata en el manejador de ruta (método del controlador)
      context.getClass(),   // Verificar metadata en la clase del controlador
    ]);

    if (isPublic) {
      return true; // Si es pública, permitir acceso sin verificar JWT
    }

    // Si no es pública, proceder con la validación JWT estándar de AuthGuard('jwt')
    return super.canActivate(context);
  }

  // Opcional: Sobreescribir handleRequest para personalizar manejo de errores
  handleRequest(err, user, info, context: ExecutionContext) {
    if (err || !user) {
        // Loguear info si es útil (ej: 'No auth token', 'jwt expired')
        // console.error('JwtAuthGuard Error:', err, 'Info:', info?.message);
        const message = info instanceof Error ? info.message : 'Unauthorized';
        throw err || new UnauthorizedException(message);
    }
    return user; // Devuelve el payload/usuario si el token es válido
  }
}
