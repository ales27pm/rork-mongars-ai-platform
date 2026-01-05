import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersistenceEntry {
  id: string;
  userId: string;
  content: string;
  embedding?: number[];
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, any>;
}

export interface PersistenceStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export class PersistenceLayer {
  private readonly KEY_PREFIX = 'mongars_persist_';
  private readonly INDEX_KEY = 'mongars_persist_index';
  private cache = new Map<string, PersistenceEntry>();

  async save(entry: PersistenceEntry): Promise<void> {
    const key = `${this.KEY_PREFIX}${entry.id}`;
    
    try {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      this.cache.set(entry.id, entry);
      await this.updateIndex(entry.id, 'add');
      
      console.log(`[Persistence] Saved entry ${entry.id}`);
    } catch (error) {
      console.error('[Persistence] Save failed:', error);
      throw error;
    }
  }

  async saveBatch(entries: PersistenceEntry[]): Promise<void> {
    const pairs: [string, string][] = entries.map(entry => [
      `${this.KEY_PREFIX}${entry.id}`,
      JSON.stringify(entry),
    ]);

    try {
      await AsyncStorage.multiSet(pairs);
      entries.forEach(e => this.cache.set(e.id, e));
      
      for (const entry of entries) {
        await this.updateIndex(entry.id, 'add');
      }
      
      console.log(`[Persistence] Saved ${entries.length} entries in batch`);
    } catch (error) {
      console.error('[Persistence] Batch save failed:', error);
      throw error;
    }
  }

  async load(id: string): Promise<PersistenceEntry | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    const key = `${this.KEY_PREFIX}${id}`;
    
    try {
      const data = await AsyncStorage.getItem(key);
      if (!data) return null;

      const entry: PersistenceEntry = JSON.parse(data);
      
      if (entry.ttl && Date.now() > entry.ttl) {
        console.log(`[Persistence] Entry ${id} expired, removing...`);
        await this.delete(id);
        return null;
      }

      this.cache.set(id, entry);
      return entry;
    } catch (error) {
      console.error('[Persistence] Load failed:', error);
      return null;
    }
  }

  async loadAll(): Promise<PersistenceEntry[]> {
    try {
      const index = await this.getIndex();
      const entries: PersistenceEntry[] = [];

      for (const id of index) {
        const entry = await this.load(id);
        if (entry) {
          entries.push(entry);
        }
      }

      console.log(`[Persistence] Loaded ${entries.length} entries`);
      return entries;
    } catch (error) {
      console.error('[Persistence] Load all failed:', error);
      return [];
    }
  }

  async delete(id: string): Promise<void> {
    const key = `${this.KEY_PREFIX}${id}`;
    
    try {
      await AsyncStorage.removeItem(key);
      this.cache.delete(id);
      await this.updateIndex(id, 'remove');
      
      console.log(`[Persistence] Deleted entry ${id}`);
    } catch (error) {
      console.error('[Persistence] Delete failed:', error);
      throw error;
    }
  }

  async query(filter: (entry: PersistenceEntry) => boolean): Promise<PersistenceEntry[]> {
    const allEntries = await this.loadAll();
    return allEntries.filter(filter);
  }

  async vectorSearch(
    queryEmbedding: number[],
    topK: number = 10
  ): Promise<(PersistenceEntry & { similarity: number })[]> {
    const allEntries = await this.loadAll();
    const withEmbeddings = allEntries.filter(e => e.embedding && e.embedding.length > 0);

    const scored = withEmbeddings.map(entry => {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding!);
      return { ...entry, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async getIndex(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(this.INDEX_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Persistence] Failed to get index:', error);
      return [];
    }
  }

  private async updateIndex(id: string, operation: 'add' | 'remove'): Promise<void> {
    const index = await this.getIndex();
    
    if (operation === 'add' && !index.includes(id)) {
      index.push(id);
    } else if (operation === 'remove') {
      const idx = index.indexOf(id);
      if (idx !== -1) {
        index.splice(idx, 1);
      }
    }

    await AsyncStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
  }

  async cleanup(maxAge: number = 86400000): Promise<number> {
    const allEntries = await this.loadAll();
    const now = Date.now();
    let cleaned = 0;

    for (const entry of allEntries) {
      const age = now - entry.timestamp;
      if (age > maxAge) {
        await this.delete(entry.id);
        cleaned++;
      }
    }

    console.log(`[Persistence] Cleaned up ${cleaned} old entries`);
    return cleaned;
  }

  async getStats(): Promise<PersistenceStats> {
    const allEntries = await this.loadAll();
    
    const stats: PersistenceStats = {
      totalEntries: allEntries.length,
      totalSize: 0,
    };

    if (allEntries.length > 0) {
      stats.oldestEntry = Math.min(...allEntries.map(e => e.timestamp));
      stats.newestEntry = Math.max(...allEntries.map(e => e.timestamp));
      stats.totalSize = JSON.stringify(allEntries).length;
    }

    return stats;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[Persistence] Cache cleared');
  }
}
