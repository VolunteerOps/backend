import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class NotificationsService {
  static async findAll() {
    return await prisma.notification.findMany({
      include: { volunteer: true, event: true },
      orderBy: { sentAt: 'desc' },
    });
  }

  static async findByVolunteer(volunteerId: number) {
    return await prisma.notification.findMany({
      where: { volunteerId },
      include: { event: true },
      orderBy: { sentAt: 'desc' },
    });
  }

  static async findByEvent(eventId: number) {
    return await prisma.notification.findMany({
      where: { eventId },
      include: { volunteer: true },
      orderBy: { sentAt: 'desc' },
    });
  }

  static async findById(id: number) {
    const notif = await prisma.notification.findUnique({
      where: { id },
      include: { volunteer: true, event: true },
    });
    if (!notif) throw ApiError.notFound('Notification');
    return notif;
  }

  static async create(data: any, sentBy?: number) {
    return await prisma.notification.create({
      data: {
        volunteerId: data.volunteer_id,
        eventId: data.event_id,
        notificationType: data.notification_type || 'BROADCAST_ALERT',
        priority: data.priority || 'normal',
        title: data.title || 'Operational Alert',
        message: data.message,
        sentBy,
      },
    });
  }

  static async createBulk(volunteerIds: number[], notification: any, sentBy?: number) {
    const created = [];
    for (const vid of volunteerIds) {
      const item = await prisma.notification.create({
        data: {
          volunteerId: vid,
          eventId: notification.event_id,
          notificationType: notification.notification_type || 'BROADCAST_ALERT',
          priority: notification.priority || 'normal',
          title: notification.title || 'Operational Alert',
          message: notification.message,
          sentBy,
        },
      });
      created.push(item);
    }
    return { count: created.length, items: created };
  }

  static async markAsRead(id: number) {
    await this.findById(id);
    return await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.notification.delete({ where: { id } });
    return { success: true };
  }
}
