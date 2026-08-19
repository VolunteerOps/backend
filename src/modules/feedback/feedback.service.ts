import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class FeedbackService {
  static async findAll() {
    return await prisma.feedback.findMany({
      include: {
        volunteer: true,
        deployment: true,
        event: true,
      },
      orderBy: { feedbackTime: 'desc' },
    });
  }

  static async findById(id: number) {
    const fb = await prisma.feedback.findUnique({
      where: { id },
      include: { volunteer: true, deployment: true, event: true },
    });
    if (!fb) throw ApiError.notFound('Feedback');
    return fb;
  }

  static async findByVolunteer(volunteerId: number) {
    return await prisma.feedback.findMany({
      where: { volunteerId },
      include: { event: true, deployment: true },
      orderBy: { feedbackTime: 'desc' },
    });
  }

  static async findByDeployment(deploymentId: number) {
    return await prisma.feedback.findMany({
      where: { deploymentId },
      include: { volunteer: true, event: true },
      orderBy: { feedbackTime: 'desc' },
    });
  }

  static async getAverageRating(volunteerId: number) {
    const aggregate = await prisma.feedback.aggregate({
      where: { volunteerId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: aggregate._avg.rating ? parseFloat(aggregate._avg.rating.toFixed(2)) : 5.0,
      total_reviews: aggregate._count.rating,
    };
  }

  static async create(data: any) {
    return await prisma.feedback.create({
      data: {
        volunteerId: data.volunteer_id,
        deploymentId: data.deployment_id,
        eventId: data.event_id,
        rating: data.rating,
        comments: data.comments,
        submittedVia: data.submitted_via || 'mobile_app',
      },
      include: { volunteer: true, event: true },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);
    return await prisma.feedback.update({
      where: { id },
      data: {
        rating: data.rating,
        comments: data.comments,
      },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.feedback.delete({ where: { id } });
    return { success: true };
  }
}
