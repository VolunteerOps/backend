import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class UsersService {
  static async findAll(query: {
    page?: number;
    limit?: number;
    role?: string;
    is_active?: boolean;
    search?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.role) {
      const normalizedRole = query.role.toUpperCase() === 'ADMIN' ? 'COORDINATOR' : query.role.toUpperCase();
      where.role = normalizedRole;
    }

    if (query.is_active !== undefined) {
      where.isActive = query.is_active;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          phoneNumber: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          volunteer: {
            select: {
              id: true,
              status: true,
              totalHours: true,
              badgeCount: true,
              _count: {
                select: {
                  skills: true,
                  deployments: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async findById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phoneNumber: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        volunteer: {
          include: {
            skills: {
              include: { skill: true },
            },
            deployments: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { event: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User');
    }

    return { success: true, data: user };
  }

  static async updateRole(id: number, role: string, actorId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User');

    const normalizedRole = role.toUpperCase() as any;

    const updated = await prisma.user.update({
      where: { id },
      data: { role: normalizedRole },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: actorId || null,
        action: 'UPDATE_USER_ROLE',
        entityType: 'User',
        entityId: id,
        oldValues: { role: user.role },
        newValues: { role: normalizedRole },
      },
    });

    return { success: true, data: updated, message: `User role updated to ${normalizedRole}` };
  }

  static async updateStatus(id: number, isActive: boolean, actorId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User');

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // If deactivating user, revoke all active refresh tokens immediately
    if (!isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: actorId || null,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entityType: 'User',
        entityId: id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive },
      },
    });

    return {
      success: true,
      data: updated,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}
