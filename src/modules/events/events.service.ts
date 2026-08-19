import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class EventsService {
  static async findAll() {
    return await prisma.event.findMany({
      include: {
        location: true,
        _count: {
          select: { deployments: true, communications: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  static async findActive() {
    return await prisma.event.findMany({
      where: {
        status: { in: ['ACTIVE', 'STAGED'] },
      },
      include: {
        location: true,
        _count: {
          select: { deployments: true, communications: true },
        },
      },
      orderBy: { priority: 'asc' },
    });
  }

  static async findByType(type: string) {
    return await prisma.event.findMany({
      where: {
        eventType: { contains: type, mode: 'insensitive' },
      },
      include: { location: true },
    });
  }

  static async findById(id: number) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        location: true,
        deployments: {
          include: { volunteer: true },
          take: 30,
        },
        communications: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { deployments: true, communications: true },
        },
      },
    });

    if (!event) {
      throw ApiError.notFound('Event / Crisis Mission');
    }

    return event;
  }

  static async create(data: any) {
    return await prisma.event.create({
      data: {
        eventName: data.event_name,
        eventType: data.event_type,
        priority: data.priority?.toUpperCase() || 'MEDIUM',
        description: data.description,
        startDate: new Date(data.start_date),
        endDate: data.end_date ? new Date(data.end_date) : null,
        locationId: data.location_id,
        status: data.status?.toUpperCase() || 'ACTIVE',
        requiredVolunteers: data.required_volunteers || 10,
        coordinatorName: data.coordinator_name,
        requiredSkills: data.required_skills,
        tags: data.tags || [],
      },
      include: { location: true },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);

    return await prisma.event.update({
      where: { id },
      data: {
        eventName: data.event_name,
        eventType: data.event_type,
        priority: data.priority?.toUpperCase(),
        description: data.description,
        startDate: data.start_date ? new Date(data.start_date) : undefined,
        endDate: data.end_date ? new Date(data.end_date) : undefined,
        locationId: data.location_id,
        status: data.status?.toUpperCase(),
        requiredVolunteers: data.required_volunteers,
        coordinatorName: data.coordinator_name,
        requiredSkills: data.required_skills,
        tags: data.tags,
      },
      include: { location: true },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.event.delete({ where: { id } });
    return { success: true };
  }
}
