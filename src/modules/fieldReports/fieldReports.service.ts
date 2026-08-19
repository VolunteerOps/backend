import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class FieldReportsService {
  static async findAll() {
    return await prisma.fieldReport.findMany({
      include: {
        deployment: {
          include: {
            volunteer: true,
            event: true,
          },
        },
      },
      orderBy: { reportTime: 'desc' },
    });
  }

  static async findById(id: number) {
    const report = await prisma.fieldReport.findUnique({
      where: { id },
      include: {
        deployment: {
          include: {
            volunteer: true,
            event: true,
          },
        },
      },
    });

    if (!report) {
      throw ApiError.notFound('Field Report');
    }

    return report;
  }

  static async findByDeployment(deploymentId: number) {
    return await prisma.fieldReport.findMany({
      where: { deploymentId },
      include: {
        deployment: { include: { volunteer: true, event: true } },
      },
      orderBy: { reportTime: 'desc' },
    });
  }

  static async findByEvent(eventId: number) {
    return await prisma.fieldReport.findMany({
      where: {
        deployment: { eventId },
      },
      include: {
        deployment: { include: { volunteer: true, event: true } },
      },
      orderBy: { reportTime: 'desc' },
    });
  }

  static async findByType(reportType: string) {
    return await prisma.fieldReport.findMany({
      where: {
        reportType: { contains: reportType, mode: 'insensitive' },
      },
      include: {
        deployment: { include: { volunteer: true, event: true } },
      },
      orderBy: { reportTime: 'desc' },
    });
  }

  static async create(data: any) {
    return await prisma.fieldReport.create({
      data: {
        deploymentId: data.deployment_id,
        reportTime: new Date(),
        reportType: data.report_type?.toUpperCase() || 'GENERAL_UPDATE',
        priority: data.priority || 'medium',
        textResponse: data.text_response,
        mediaUrl: data.media_url,
        fileUploadUrl: data.file_upload_url,
        latitude: data.latitude,
        longitude: data.longitude,
        submittedVia: data.submitted_via || 'mobile_app',
        status: 'submitted',
      },
      include: {
        deployment: { include: { volunteer: true, event: true } },
      },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);
    return await prisma.fieldReport.update({
      where: { id },
      data: {
        reportType: data.report_type?.toUpperCase(),
        priority: data.priority,
        textResponse: data.text_response,
        mediaUrl: data.media_url,
        fileUploadUrl: data.file_upload_url,
        status: data.status,
        verifiedBy: data.verified_by,
      },
      include: {
        deployment: { include: { volunteer: true, event: true } },
      },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.fieldReport.delete({ where: { id } });
    return { success: true };
  }
}
