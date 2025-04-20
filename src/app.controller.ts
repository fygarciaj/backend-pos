import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators/public.decorator'; // Importar el decorador Public
import { ApiBearerAuth } from '@nestjs/swagger'; // Importar ApiBearerAuth para la documentación de Swagger

@Controller()
@Public() // Aplicar el decorador Public a todo el controlador
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiBearerAuth()
  healthCheck(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }
}
