export interface WebSocketClient {
  id: string;
  socket: any;
  queue: string[];
  tokenBucket: TokenBucket;
  lastActivity: number;
  userId: string;
}

export interface TokenBucket {
  capacity: number;
  tokens: number;
  refillRate: number;
  lastRefill: number;
}

export class WebSocketManager {
  private clients = new Map<string, WebSocketClient>();
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly DEFAULT_CAPACITY = 10;
  private readonly REFILL_RATE = 2;
  private readonly REFILL_INTERVAL = 1000;

  addClient(id: string, socket: any, userId: string): void {
    const client: WebSocketClient = {
      id,
      socket,
      queue: [],
      tokenBucket: this.createTokenBucket(),
      lastActivity: Date.now(),
      userId,
    };

    this.clients.set(id, client);
    console.log(`[WSManager] Client ${id} connected (user: ${userId})`);
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);
      console.log(`[WSManager] Client ${id} disconnected`);
    }
  }

  sendEvent(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[WSManager] Client ${clientId} not found`);
      return false;
    }

    if (!this.consumeToken(client)) {
      console.warn(`[WSManager] Rate limit exceeded for client ${clientId}`);
      return false;
    }

    const payload = JSON.stringify({ event, data, timestamp: Date.now() });

    if (client.queue.length >= this.MAX_QUEUE_SIZE) {
      console.error(`[WSManager] Queue full for client ${clientId}, disconnecting...`);
      this.removeClient(clientId);
      return false;
    }

    client.queue.push(payload);
    client.lastActivity = Date.now();
    this.drainQueue(client);

    return true;
  }

  broadcast(event: string, data: any, userFilter?: (userId: string) => boolean): void {
    for (const client of this.clients.values()) {
      if (userFilter && !userFilter(client.userId)) {
        continue;
      }

      this.sendEvent(client.id, event, data);
    }
  }

  private createTokenBucket(): TokenBucket {
    return {
      capacity: this.DEFAULT_CAPACITY,
      tokens: this.DEFAULT_CAPACITY,
      refillRate: this.REFILL_RATE,
      lastRefill: Date.now(),
    };
  }

  private consumeToken(client: WebSocketClient, cost: number = 1): boolean {
    this.refillBucket(client.tokenBucket);

    if (client.tokenBucket.tokens >= cost) {
      client.tokenBucket.tokens -= cost;
      return true;
    }

    return false;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillAmount = (elapsed / this.REFILL_INTERVAL) * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  private drainQueue(client: WebSocketClient): void {
    while (client.queue.length > 0) {
      const message = client.queue.shift();
      console.log(`[WSManager] Sending to ${client.id}: ${message?.slice(0, 50)}...`);
    }
  }

  getStats() {
    const stats = {
      totalClients: this.clients.size,
      queueSizes: Array.from(this.clients.values()).map(c => c.queue.length),
      tokenLevels: Array.from(this.clients.values()).map(c => c.tokenBucket.tokens),
      avgQueueSize: 0,
      avgTokenLevel: 0,
    };

    if (stats.totalClients > 0) {
      stats.avgQueueSize = stats.queueSizes.reduce((a, b) => a + b, 0) / stats.totalClients;
      stats.avgTokenLevel = stats.tokenLevels.reduce((a, b) => a + b, 0) / stats.totalClients;
    }

    return stats;
  }

  cleanupStaleClients(maxAge: number = 300000): void {
    const now = Date.now();
    const staleClients: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      if (now - client.lastActivity > maxAge) {
        staleClients.push(id);
      }
    }

    staleClients.forEach(id => this.removeClient(id));

    if (staleClients.length > 0) {
      console.log(`[WSManager] Cleaned up ${staleClients.length} stale clients`);
    }
  }
}
