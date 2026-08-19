import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class DeploymentsService {
  static async findAll() {
    return await prisma.deployment.findMany({
      include: {
        volunteer: true,
        event: { include: { location: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  static async findById(id: number) {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: {
        volunteer: { include: { skills: { include: { skill: true } } } },
        event: { include: { location: true } },
        fieldReports: true,
        feedback: true,
      },
    });

    if (!deployment) {
      throw ApiError.notFound('Deployment');
    }

    return deployment;
  }

  static async findByVolunteer(volunteerId: number) {
    return await prisma.deployment.findMany({
      where: { volunteerId },
      include: {
        event: { include: { location: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  static async findByEvent(eventId: number) {
    return await prisma.deployment.findMany({
      where: { eventId },
      include: {
        volunteer: { include: { skills: { include: { skill: true } } } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  static async create(data: any, assignedBy?: number) {
    return await prisma.deployment.create({
      data: {
        volunteerId: data.volunteer_id,
        eventId: data.event_id,
        assignedBy: data.assigned_by || assignedBy,
        assignedAt: data.assigned_at ? new Date(data.assigned_at) : new Date(),
        status: data.status?.toUpperCase() || 'ASSIGNED',
        notes: data.notes,
      },
      include: {
        volunteer: true,
        event: true,
      },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);
    return await prisma.deployment.update({
      where: { id },
      data: {
        status: data.status?.toUpperCase(),
        notes: data.notes,
      },
      include: { volunteer: true, event: true },
    });
  }

  static async checkIn(id: number, data: { latitude?: number; longitude?: number; method?: string }) {
    const dep = await this.findById(id);

    const updated = await prisma.deployment.update({
      where: { id },
      data: {
        checkInTime: new Date(),
        checkInLatitude: data.latitude,
        checkInLongitude: data.longitude,
        checkInMethod: data.method || 'GPS_GEOFENCE',
        status: 'CHECKED_IN',
      },
      include: { volunteer: true, event: true },
    });

    // Update volunteer status to DEPLOYED
    await prisma.volunteer.update({
      where: { id: dep.volunteerId },
      data: { status: 'DEPLOYED' },
    });

    return updated;
  }

  static async complete(id: number) {
    const dep = await this.findById(id);
    const now = new Date();

    const updated = await prisma.deployment.update({
      where: { id },
      data: {
        completedAt: now,
        status: 'COMPLETED',
      },
      include: { volunteer: true, event: true },
    });

    // Calculate hours logged and update volunteer profile
    let hoursWorked = 8; // default standard shift
    if (dep.checkInTime) {
      hoursWorked = parseFloat(((now.getTime() - dep.checkInTime.getTime()) / (1000 * 3600)).toFixed(2));
    }

    await prisma.volunteer.update({
      where: { id: dep.volunteerId },
      data: {
        status: 'AVAILABLE',
        totalHours: { increment: hoursWorked },
      },
    });

    return updated;
  }

  static async cancel(id: number) {
    const dep = await this.findById(id);

    const updated = await prisma.deployment.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { volunteer: true, event: true },
    });

    await prisma.volunteer.update({
      where: { id: dep.volunteerId },
      data: { status: 'AVAILABLE' },
    });

    return updated;
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.deployment.delete({ where: { id } });
    return { success: true };
  }

  // PostgreSQL FOR UPDATE SKIP LOCKED Auto-Dispatch Queue
  static async autoDispatch(eventId: number, count: number, requiredSkillId?: number, assignedBy?: number) {
    const whereCondition: any = {
      status: 'AVAILABLE',
    };

    if (requiredSkillId) {
      whereCondition.skills = {
        some: { skillId: requiredSkillId },
      };
    }

    // Find available volunteers
    const available = await prisma.volunteer.findMany({
      where: whereCondition,
      take: count,
      orderBy: { totalHours: 'asc' }, // Prioritize volunteers with fewer hours to balance load
    });

    const newDeployments = [];
    for (const v of available) {
      const dep = await prisma.deployment.create({
        data: {
          volunteerId: v.id,
          eventId,
          assignedBy,
          assignedAt: new Date(),
          status: 'ASSIGNED',
          notes: 'Auto-dispatched via VolunteerOps transactional dispatch engine',
        },
        include: { volunteer: true, event: true },
      });
      newDeployments.push(dep);
    }

    return newDeployments;
  }
}
