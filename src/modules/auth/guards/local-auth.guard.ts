import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') { // Usa la estrategia 'local' registrada
    // Opcional: Puedes sobreescribir handleRequest para personalizar el manejo de errores o éxito
    handleRequest(err, user, info, context: ExecutionContext) {
        if (err || !user) {
            // Loguear info si es útil para depurar (ej: 'Missing credentials')
            // console.error('LocalAuthGuard Error:', err, 'Info:', info?.message);
            throw err || new UnauthorizedException(info?.message || 'Login failed');
        }
        return user; // Devuelve el usuario si la autenticación fue exitosa
    }
}
