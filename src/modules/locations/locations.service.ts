import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class LocationsService {
  static async findAll() {
    return await prisma.location.findMany({
      include: {
        _count: {
          select: { events: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  static async findById(id: number) {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        events: {
          where: { status: { in: ['ACTIVE', 'STAGED'] } },
        },
      },
    });

    if (!location) {
      throw ApiError.notFound('Location');
    }

    return location;
  }

  static async create(data: any) {
    return await prisma.location.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country || 'USA',
        latitude: data.latitude,
        longitude: data.longitude,
        osmId: data.osm_id || Math.floor(Math.random() * 100000),
        hazardLevel: data.hazard_level || 'low',
        radiusMeters: data.radius_meters || 5000,
      },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);
    return await prisma.location.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        osmId: data.osm_id,
        hazardLevel: data.hazard_level,
        radiusMeters: data.radius_meters,
      },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.location.delete({ where: { id } });
    return { success: true };
  }
}
