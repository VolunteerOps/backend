import { Response } from 'express';
import { prisma } from '../../core/prisma.js';

// Live Server-Sent Events (SSE) Client Subscribers Pool
class EventStreamManager {
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

export class CommunicationsService {
  static async getChannels() {
    const messages = await prisma.communication.findMany({
      select: { channelId: true },
      distinct: ['channelId'],
    });

    const defaultChannels = [
      { id: 'alerts', name: 'Emergency Alerts', icon: 'AlertTriangle', color: 'text-red-600' },
      { id: 'teams', name: 'Team Messages', icon: 'Users', color: 'text-blue-600' },
      { id: 'general', name: 'General Updates', icon: 'MessageSquare', color: 'text-green-600' },
      { id: 'coordination', name: 'Coordination', icon: 'Phone', color: 'text-purple-600' },
      { id: 'medical_alpha', name: 'Medical Alpha', icon: 'Activity', color: 'text-emerald-600' },
      { id: 'logistics_bravo', name: 'Logistics Bravo', icon: 'Truck', color: 'text-amber-600' },
    ];

    const channelCounts = await prisma.communication.groupBy({
      by: ['channelId'],
      _count: { _all: true },
    });

    const countMap = Object.fromEntries((channelCounts as any[]).map((c: any) => [c.channelId, c._count._all]));

    return defaultChannels.map((ch) => ({
      ...ch,
      count: countMap[ch.id] || 0,
    }));
  }

  static async getMessages(channelId: string, limit = 50) {
    return await prisma.communication.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  static async sendMessage(data: any, sender: { id?: number; name: string; role: string }) {
    const msg = await prisma.communication.create({
      data: {
        eventId: data.event_id,
        channelId: data.channel_id || 'general',
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        message: data.message,
        priority: data.priority || 'normal',
        messageType: data.message_type || 'text',
        mediaUrl: data.media_url,
      },
    });

    // Realtime push notification via SSE
    EventStreamManager.broadcast('new_message', msg);
    return msg;
  }

  static async broadcastAlert(data: any, sender: { id?: number; name: string; role: string }) {
    const channels = data.target_channels || ['alerts'];
    const createdAlerts = [];

    for (const ch of channels) {
      const alert = await prisma.communication.create({
        data: {
          eventId: data.event_id,
          channelId: ch,
          senderId: sender.id,
          senderName: sender.name,
          senderRole: sender.role,
          message: `[ALERT: ${data.title}] ${data.message}`,
          priority: data.priority || 'critical',
          messageType: 'alert',
        },
      });
      createdAlerts.push(alert);
    }

    // Broadcast emergency push event
    EventStreamManager.broadcast('emergency_alert', {
      title: data.title,
      message: data.message,
      priority: data.priority || 'critical',
      timestamp: new Date().toISOString(),
    });

    return createdAlerts;
  }

  static subscribeToStream(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initial ping
    res.write('event: connected\ndata: {"status":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');
    EventStreamManager.addSubscriber(res);
  }
}
