import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';

export class SkillsService {
  static async findAll() {
    const skills = await prisma.skill.findMany({
      include: {
        _count: {
          select: { volunteerSkills: true },
        },
      },
      orderBy: { category: 'asc' },
    });

    return skills.map((s: any) => ({
      ...s,
      volunteer_count: s._count?.volunteerSkills || 0,
    }));
  }

  static async findCategories() {
    const skills = await prisma.skill.findMany({
      select: { category: true, demandLevel: true },
    });

    const categoryMap: Record<string, { name: string; count: number; criticalCount: number }> = {};

    for (const s of skills) {
      if (!categoryMap[s.category]) {
        categoryMap[s.category] = { name: s.category, count: 0, criticalCount: 0 };
      }
      categoryMap[s.category].count++;
      if (s.demandLevel === 'critical') {
        categoryMap[s.category].criticalCount++;
      }
    }

    return Object.values(categoryMap);
  }

  static async findById(id: number) {
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: {
        volunteerSkills: {
          include: { volunteer: true },
        },
        _count: {
          select: { volunteerSkills: true },
        },
      },
    });

    if (!skill) {
      throw ApiError.notFound('Skill');
    }

    return {
      ...skill,
      volunteer_count: skill._count.volunteerSkills,
    };
  }

  static async getVolunteerCount(id: number) {
    const count = await prisma.volunteerSkill.count({
      where: { skillId: id },
    });
    return { count };
  }

  static async create(data: { skill_name: string; category: string; demand_level?: string; description: string }) {
    return await prisma.skill.create({
      data: {
        skillName: data.skill_name,
        category: data.category,
        demandLevel: data.demand_level || 'medium',
        description: data.description,
      },
    });
  }

  static async update(id: number, data: any) {
    await this.findById(id);
    return await prisma.skill.update({
      where: { id },
      data: {
        skillName: data.skill_name,
        category: data.category,
        demandLevel: data.demand_level,
        description: data.description,
      },
    });
  }

  static async delete(id: number) {
    await this.findById(id);
    await prisma.skill.delete({ where: { id } });
    return { success: true };
  }

  // AI Semantic Match Simulation (pgvector compatible)
  static async semanticMatch(incidentDesc: string, limit: number) {
    const skills = await prisma.skill.findMany({
      include: {
        _count: { select: { volunteerSkills: true } },
      },
    });

    const lowerDesc = incidentDesc.toLowerCase();
    const scoredSkills = skills.map((s) => {
      let score = 0.5; // baseline similarity
      const nameTokens = s.skillName.toLowerCase().split(' ');
      const descTokens = s.description.toLowerCase().split(' ');

      for (const token of [...nameTokens, ...descTokens]) {
        if (token.length > 3 && lowerDesc.includes(token)) {
          score += 0.15;
        }
      }

      if (s.demandLevel === 'critical') score += 0.1;

      return {
        ...s,
        similarity_score: parseFloat(Math.min(score, 0.99).toFixed(3)),
        volunteer_count: s._count.volunteerSkills,
      };
    });

    return scoredSkills
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }
}
