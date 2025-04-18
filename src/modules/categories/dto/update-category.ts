import { PartialType } from '@nestjs/swagger'; // Usar PartialType de swagger para DTOs opcionales
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
