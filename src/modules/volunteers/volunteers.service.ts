import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class VolunteersService {
  static async findAll(query: { search?: string; status?: string; skillId?: number; limit?: number; offset?: number }) {
    const where: any = {};

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.skillId) {
      where.skills = {
        some: { skillId: query.skillId },
      };
    }

    return await prisma.volunteer.findMany({
      where,
      include: {
        skills: {
          include: { skill: true },
        },
      },
      take: query.limit || 50,
      skip: query.offset || 0,
      orderBy: { id: 'desc' },
    });
  }

  static async findAvailable() {
    return await prisma.volunteer.findMany({
      where: {
        OR: [{ status: 'AVAILABLE' as any }, { status: 'ACTIVE' as any }],
      },
      include: {
        skills: {
          include: { skill: true },
        },
      },
      orderBy: { totalHours: 'desc' },
    });
  }

  static async findNearby(lat: number, lng: number, radiusKm: number) {
    const volunteers = await prisma.volunteer.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        OR: [{ status: 'AVAILABLE' as any }, { status: 'ACTIVE' as any }],
      },
      include: {
        skills: { include: { skill: true } },
      },
    });

    const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    return volunteers
      .map((v) => {
        const distance = calculateDistanceKm(lat, lng, Number(v.latitude), Number(v.longitude));
        return { ...v, distance_km: parseFloat(distance.toFixed(2)) };
      })
      .filter((v) => v.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  static async findById(id: number) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
        },
        deployments: {
          include: { event: true },
          take: 10,
          orderBy: { assignedAt: 'desc' },
        },
        feedback: {
          take: 5,
          orderBy: { feedbackTime: 'desc' },
        },
      },
    });

    if (!volunteer) {
      throw ApiError.notFound('Volunteer');
    }

    return volunteer;
  }

  static async findBySkill(skillId: number) {
    return await prisma.volunteer.findMany({
      where: {
        skills: {
          some: { skillId },
        },
      },
      include: {
        skills: { include: { skill: true } },
      },
    });
  }

  static async create(data: any) {
    return await prisma.volunteer.create({
      data: {
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        email: data.email.toLowerCase(),
        registrationChannel: data.registration_channel || 'inbuilt',
        consentGiven: data.consent_given ?? true,
        registrationDate: data.registration_date ? new Date(data.registration_date) : new Date(),
        status: (data.status?.toUpperCase() === 'ACTIVE' ? 'AVAILABLE' : data.status?.toUpperCase()) || 'AVAILABLE',
        dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : null,
        emergencyContact: data.emergency_contact,
        bio: data.bio,
        availabilitySchedule: data.availability_schedule,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);

    return await prisma.volunteer.update({
      where: { id },
      data: {
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        email: data.email?.toLowerCase(),
        status: data.status?.toUpperCase(),
        dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
        emergencyContact: data.emergency_contact,
        bio: data.bio,
        availabilitySchedule: data.availability_schedule,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.volunteer.delete({ where: { id } });
    return { success: true };
  }

  static async addSkill(volunteerId: number, data: { skill_id: number; proficiency_level: string; is_certified?: boolean; certification_date?: string; certified_by?: string }) {
    await this.findById(volunteerId);

    return await prisma.volunteerSkill.create({
      data: {
        volunteerId,
        skillId: data.skill_id,
        proficiencyLevel: data.proficiency_level,
        isCertified: data.is_certified ?? false,
        certificationDate: data.certification_date ? new Date(data.certification_date) : null,
        certifiedBy: data.certified_by,
      },
    });
  }

  static async updateSkillLink(linkId: number, data: { proficiency_level?: string; is_certified?: boolean }) {
    return await prisma.volunteerSkill.update({
      where: { id: linkId },
      data: {
        proficiencyLevel: data.proficiency_level,
        isCertified: data.is_certified,
      },
    });
  }

  static async removeSkillLink(linkId: number) {
    await prisma.volunteerSkill.delete({ where: { id: linkId } });
    return { success: true };
  }
}
