import { Category } from '@prisma/client';

export interface CategoryWithSubcategories extends Category {
  subcategories?: CategoryWithSubcategories[];
  _count?: {
    products: number;
    subcategories: number;
  };
}

export interface CategoryTree extends Omit<Category, 'subcategories'> {
  children: CategoryTree[];
  _count?: {
    products: number;
    subcategories: number;
  };
}
