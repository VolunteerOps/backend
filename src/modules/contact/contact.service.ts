import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class ContactService {
  static async submitInquiry(data: any, ipAddress?: string) {
    const submission = await prisma.contactSubmission.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        subject: data.subject,
        message: data.message,
        organization: data.organization,
        inquiryType: data.inquiry_type || 'general',
        status: 'NEW',
        ipAddress,
      },
    });

    return submission;
  }

  static async findAll(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    return await prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: number) {
    const submission = await prisma.contactSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw ApiError.notFound('Contact Submission');
    }

    return submission;
  }

  static async updateStatus(id: number, status: string, responseNotes?: string) {
    await this.findById(id);

    return await prisma.contactSubmission.update({
      where: { id },
      data: {
        status: status as any,
        responseNotes,
      },
    });
  }
}
