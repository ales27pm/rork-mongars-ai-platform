export interface AdapterMetadata {
  id: string;
  version: string;
  baseModel: string;
  adapterType: 'lora' | 'prefix' | 'adapter';
  trainingTimestamp: number;
  metrics: {
    loss: number;
    perplexity: number;
    samples: number;
  };
  checksum: string;
  path: string;
}

export interface ModelManifest {
  manifestVersion: string;
  lastUpdated: number;
  activeAdapter?: string;
  adapters: AdapterMetadata[];
}

export class ManifestManager {
  private manifest: ModelManifest = {
    manifestVersion: '1.0.0',
    lastUpdated: Date.now(),
    adapters: [],
  };

  registerAdapter(metadata: Omit<AdapterMetadata, 'id'>): void {
    const adapter: AdapterMetadata = {
      id: `adapter_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...metadata,
    };

    this.manifest.adapters.push(adapter);
    this.manifest.lastUpdated = Date.now();

    console.log(`[Manifest] Registered adapter ${adapter.id} v${adapter.version}`);
  }

  setActiveAdapter(adapterId: string): boolean {
    const adapter = this.manifest.adapters.find(a => a.id === adapterId);
    
    if (!adapter) {
      console.error(`[Manifest] Adapter ${adapterId} not found`);
      return false;
    }

    this.manifest.activeAdapter = adapterId;
    this.manifest.lastUpdated = Date.now();

    console.log(`[Manifest] Activated adapter ${adapterId} (${adapter.version})`);
    return true;
  }

  getActiveAdapter(): AdapterMetadata | null {
    if (!this.manifest.activeAdapter) return null;

    return this.manifest.adapters.find(a => a.id === this.manifest.activeAdapter) || null;
  }

  listAdapters(): AdapterMetadata[] {
    return [...this.manifest.adapters].sort((a, b) => b.trainingTimestamp - a.trainingTimestamp);
  }

  getAdapterByVersion(version: string): AdapterMetadata | null {
    return this.manifest.adapters.find(a => a.version === version) || null;
  }

  rollbackToVersion(version: string): boolean {
    const adapter = this.getAdapterByVersion(version);
    
    if (!adapter) {
      console.error(`[Manifest] Version ${version} not found`);
      return false;
    }

    return this.setActiveAdapter(adapter.id);
  }

  pruneOldAdapters(keepCount: number = 10): void {
    const sorted = this.listAdapters();
    const active = this.manifest.activeAdapter;

    const toKeep = sorted.slice(0, keepCount).map(a => a.id);
    
    if (active && !toKeep.includes(active)) {
      toKeep.push(active);
    }

    const before = this.manifest.adapters.length;
    this.manifest.adapters = this.manifest.adapters.filter(a => toKeep.includes(a.id));
    const after = this.manifest.adapters.length;

    console.log(`[Manifest] Pruned ${before - after} old adapters (kept ${after})`);
  }

  verifyChecksum(adapterId: string, actualChecksum: string): boolean {
    const adapter = this.manifest.adapters.find(a => a.id === adapterId);
    
    if (!adapter) return false;

    const valid = adapter.checksum === actualChecksum;

    if (!valid) {
      console.error(`[Manifest] Checksum mismatch for ${adapterId}`);
    }

    return valid;
  }

  exportManifest(): ModelManifest {
    return JSON.parse(JSON.stringify(this.manifest));
  }

  importManifest(manifest: ModelManifest): void {
    this.manifest = manifest;
    console.log(`[Manifest] Imported manifest with ${manifest.adapters.length} adapters`);
  }

  getStats() {
    return {
      totalAdapters: this.manifest.adapters.length,
      activeAdapter: this.manifest.activeAdapter,
      oldestAdapter: this.manifest.adapters.length > 0
        ? Math.min(...this.manifest.adapters.map(a => a.trainingTimestamp))
        : null,
      newestAdapter: this.manifest.adapters.length > 0
        ? Math.max(...this.manifest.adapters.map(a => a.trainingTimestamp))
        : null,
      lastUpdated: this.manifest.lastUpdated,
    };
  }
}
