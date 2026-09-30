import { Response } from 'express';
import { prisma } from '../../core/prisma.js';

class TelemetryStreamManager {
  private static subscribers: Set<Response> = new Set();

  static addSubscriber(res: Response) {
    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });
  }

  static broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.subscribers) {
      client.write(payload);
    }
  }
}

export class TelemetryService {
  static async recordPing(data: any) {
    const ping = await prisma.telemetryPing.create({
      data: {
        volunteerId: data.volunteer_id,
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        batteryLevel: data.battery_level,
        speed: data.speed,
        heading: data.heading,
        isDistress: false,
      },
    });

    // Update volunteer's last known coordinates
    await prisma.volunteer.update({
      where: { id: data.volunteer_id },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    TelemetryStreamManager.broadcast('telemetry_ping', ping);
    return ping;
  }

  static async triggerSOS(data: any) {
    const ping = await prisma.telemetryPing.create({
      data: {
        volunteerId: data.volunteer_id,
        latitude: data.latitude,
        longitude: data.longitude,
        isDistress: true,
      },
    });

    // Create a high priority emergency alert in communications
    const volunteer = await prisma.volunteer.findUnique({ where: { id: data.volunteer_id } });

    await prisma.communication.create({
      data: {
        channelId: 'alerts',
        senderName: volunteer?.fullName || `Volunteer #${data.volunteer_id}`,
        senderRole: 'VOLUNTEER',
        message: `🚨 SOS DISTRESS BEACON: ${volunteer?.fullName} activated emergency distress beacon at coordinates (${data.latitude}, ${data.longitude})! Immediate backup requested.`,
        priority: 'critical',
        messageType: 'alert',
      },
    });

    TelemetryStreamManager.broadcast('sos_beacon', {
      volunteer_id: data.volunteer_id,
      volunteer_name: volunteer?.fullName,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: 'Distress beacon broadcasted to command center' };
  }

  static async getActiveFleet() {
    const volunteers = await prisma.volunteer.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        status: { in: ['ACTIVE', 'DEPLOYED', 'AVAILABLE'] as any },
      },
      include: {
        skills: { include: { skill: true } },
      },
    });

    return volunteers.map((v) => ({
      id: v.id,
      name: v.fullName,
      status: v.status,
      phone: v.phoneNumber,
      lat: Number(v.latitude),
      lng: Number(v.longitude),
      total_hours: Number(v.totalHours),
      skills: v.skills.flatMap((s) => s.skill ? [s.skill.skillName] : []),
    }));
  }

  static subscribeToStream(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write('event: telemetry_connected\ndata: {"status":"connected"}\n\n');
    TelemetryStreamManager.addSubscriber(res);
  }
}
