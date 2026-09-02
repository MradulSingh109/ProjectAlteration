import { prisma } from '../config/database';
import { CreateProductInput, ProductQueryInput } from '../schemas/product.schema';
import { AuditService } from './audit.service';
import { AppError } from '../utils/AppError';

export class ProductService {
  static async listCategories() {
    return prisma.productCategory.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  static async listProducts(query: ProductQueryInput) {
    const { page, limit, search, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
        { manufacturerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          brandName: true,
          manufacturerName: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        brandName: true,
        manufacturerName: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw AppError.notFound('Product not found or has been deleted', 'PRODUCT_NOT_FOUND');
    }

    return product;
  }

  static async createProduct(
    input: CreateProductInput,
    userId: string,
    reqCtx?: { ip?: string; userAgent?: string }
  ) {
    // Verify category exists and is active
    const category = await prisma.productCategory.findFirst({
      where: {
        id: input.categoryId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw AppError.notFound('Specified product category does not exist or has been deleted', 'CATEGORY_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: input.name,
          brandName: input.brandName,
          manufacturerName: input.manufacturerName,
          categoryId: input.categoryId,
          description: input.description || null,
        },
        select: {
          id: true,
          name: true,
          brandName: true,
          manufacturerName: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      await AuditService.logAction(
        {
          userId,
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: product.id,
          newValue: product as unknown as Record<string, unknown>,
          ipAddress: reqCtx?.ip,
          userAgent: reqCtx?.userAgent,
        },
        tx
      );

      return product;
    });
  }
}
