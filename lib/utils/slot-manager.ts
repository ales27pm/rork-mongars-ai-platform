export interface ModelSlot {
  id: string;
  modelName: string;
  loaded: boolean;
  vramUsage: number;
  lastUsed: number;
  accessCount: number;
  temperature: number;
}

export interface SlotSnapshot {
  slotId: string;
  timestamp: number;
  vramUsage: number;
  state: 'hot' | 'warm' | 'cold';
}

export class ModelSlotManager {
  private slots: Map<string, ModelSlot> = new Map();
  private snapshots: SlotSnapshot[] = [];
  private readonly MAX_VRAM = 24 * 1024;
  private readonly OFFLOAD_THRESHOLD = 0.8;
  private currentVramUsage = 0;

  acquireSlot(modelName: string, requiredVram: number): ModelSlot | null {
    const existingSlot = Array.from(this.slots.values()).find(
      s => s.modelName === modelName && s.loaded
    );

    if (existingSlot) {
      existingSlot.lastUsed = Date.now();
      existingSlot.accessCount++;
      existingSlot.temperature = this.calculateTemperature(existingSlot);
      console.log(`[SlotManager] Reusing hot slot for ${modelName}`);
      return existingSlot;
    }

    if (this.currentVramUsage + requiredVram > this.MAX_VRAM * this.OFFLOAD_THRESHOLD) {
      console.log('[SlotManager] VRAM pressure - evicting cold slots');
      this.evictColdSlots(requiredVram);
    }

    const slotId = `slot_${Date.now()}`;
    const slot: ModelSlot = {
      id: slotId,
      modelName,
      loaded: true,
      vramUsage: requiredVram,
      lastUsed: Date.now(),
      accessCount: 1,
      temperature: 1.0,
    };

    this.slots.set(slotId, slot);
    this.currentVramUsage += requiredVram;

    console.log(`[SlotManager] Allocated slot ${slotId} for ${modelName} (${requiredVram}MB)`);
    return slot;
  }

  releaseSlot(slotId: string, force: boolean = false): void {
    const slot = this.slots.get(slotId);
    if (!slot) return;

    const usageFraction = this.currentVramUsage / this.MAX_VRAM;

    if (force || usageFraction >= this.OFFLOAD_THRESHOLD) {
      this.snapshotAndRelease(slot);
    } else {
      console.log(`[SlotManager] Keeping slot ${slotId} warm (usage: ${(usageFraction * 100).toFixed(1)}%)`);
    }
  }

  private snapshotAndRelease(slot: ModelSlot): void {
    const snapshot: SlotSnapshot = {
      slotId: slot.id,
      timestamp: Date.now(),
      vramUsage: slot.vramUsage,
      state: this.getSlotState(slot),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    this.currentVramUsage -= slot.vramUsage;
    slot.loaded = false;

    console.log(`[SlotManager] Snapshot and released ${slot.id} (freed ${slot.vramUsage}MB)`);
    this.emptyCudaCache();
  }

  private evictColdSlots(requiredVram: number): void {
    const sortedSlots = Array.from(this.slots.values())
      .filter(s => s.loaded)
      .sort((a, b) => this.calculateTemperature(a) - this.calculateTemperature(b));

    let freedVram = 0;
    for (const slot of sortedSlots) {
      if (freedVram >= requiredVram) break;

      this.snapshotAndRelease(slot);
      freedVram += slot.vramUsage;
    }
  }

  private calculateTemperature(slot: ModelSlot): number {
    const now = Date.now();
    const ageMinutes = (now - slot.lastUsed) / 60000;
    const recencyScore = Math.exp(-ageMinutes / 30);
    const frequencyScore = Math.min(1, slot.accessCount / 100);
    
    return recencyScore * 0.7 + frequencyScore * 0.3;
  }

  private getSlotState(slot: ModelSlot): 'hot' | 'warm' | 'cold' {
    const temp = this.calculateTemperature(slot);
    if (temp > 0.7) return 'hot';
    if (temp > 0.3) return 'warm';
    return 'cold';
  }

  private emptyCudaCache(): void {
    console.log('[SlotManager] Emptying CUDA cache (simulated)');
  }

  getStats() {
    return {
      totalSlots: this.slots.size,
      loadedSlots: Array.from(this.slots.values()).filter(s => s.loaded).length,
      vramUsage: this.currentVramUsage,
      vramCapacity: this.MAX_VRAM,
      vramUtilization: (this.currentVramUsage / this.MAX_VRAM) * 100,
      snapshots: this.snapshots.length,
      hotSlots: Array.from(this.slots.values()).filter(s => this.getSlotState(s) === 'hot').length,
    };
  }
}
