import { ChromaClient } from 'chromadb';
import { Config } from '../config.js';
import { EmbeddingService } from './embedding.js';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    title?: string;
    page?: number;
    distance?: number;
  };
}

export class VectorStore {
  private client: ChromaClient;
  private collection: any;
  private config: Config;
  private embeddingService: EmbeddingService;
  private chunks: Map<string, DocumentChunk> = new Map();

  constructor(config: Config, embeddingService: EmbeddingService) {
    this.config = config;
    this.embeddingService = embeddingService;
    this.client = new ChromaClient({
      path: config.chromaUrl
    });
  }

  async initialize(): Promise<void> {
    try {
      console.error(`Attempting to connect to ChromaDB at: ${this.config.chromaUrl}`);
      // Test connection
      await this.client.heartbeat();
      console.error('Connected to ChromaDB');
      
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName
      });
      console.error(`Using collection: ${this.config.collectionName}`);
    } catch (error) {
      console.error('ChromaDB connection error:', error);
      console.warn('ChromaDB not available, falling back to in-memory storage');
      this.collection = null;
    }
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    if (this.collection) {
      // Use ChromaDB
      try {
        const ids = chunks.map(chunk => chunk.id);
        const contents = chunks.map(chunk => chunk.content);
        const metadatas = chunks.map(chunk => chunk.metadata);
        
        // Generate embeddings
        const embeddings = await this.embeddingService.generateEmbeddings(contents);
        
        await this.collection.add({
          ids,
          documents: contents,
          metadatas,
          embeddings
        });
        console.error(`Added ${chunks.length} chunks to ChromaDB`);
      } catch (error) {
        console.warn('Failed to add to ChromaDB, falling back to in-memory:', error);
        this.addToMemory(chunks);
      }
    } else {
      // Fallback to in-memory
      this.addToMemory(chunks);
    }
  }

  private addToMemory(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async search(query: string, k: number = 5): Promise<DocumentChunk[]> {
    if (this.collection) {
      // Use ChromaDB with embeddings
      try {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: k
        });

        if (!results.documents || results.documents.length === 0) {
          return [];
        }

        const chunks: DocumentChunk[] = [];
        const documents = results.documents[0];
        const metadatas = results.metadatas[0];
        const distances = results.distances?.[0] || [];

        for (let i = 0; i < documents.length; i++) {
          chunks.push({
            id: results.ids[0][i],
            content: documents[i],
            metadata: {
              ...metadatas[i],
              distance: distances[i] || 0
            }
          });
        }

        return chunks;
      } catch (error) {
        console.warn('ChromaDB search failed, falling back to text search:', error);
        return this.textSearch(query, k);
      }
    } else {
      // Fallback to text search
      return this.textSearch(query, k);
    }
  }

  private textSearch(query: string, k: number): DocumentChunk[] {
    const queryLower = query.toLowerCase();
    const results: DocumentChunk[] = [];
    
    for (const chunk of this.chunks.values()) {
      const contentLower = chunk.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        results.push({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            distance: 0
          }
        });
      }
    }
    
    // Sort by relevance (simple word count matching)
    results.sort((a, b) => {
      const aMatches = (a.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      const bMatches = (b.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      return bMatches - aMatches;
    });
    
    return results.slice(0, k);
  }

  async getChunk(id: string): Promise<DocumentChunk | null> {
    if (this.collection) {
      try {
        const results = await this.collection.get({
          ids: [id]
        });

        if (!results.documents || results.documents.length === 0) {
          return null;
        }

        return {
          id: results.ids[0],
          content: results.documents[0],
          metadata: results.metadatas[0]
        };
      } catch (error) {
        console.warn('ChromaDB getChunk failed, falling back to memory:', error);
        return this.chunks.get(id) || null;
      }
    } else {
      return this.chunks.get(id) || null;
    }
  }

  async getCollectionStats(): Promise<{ count: number; sources: string[] }> {
    if (this.collection) {
      try {
        const results = await this.collection.get();
        const sources = new Set<string>();
        
        if (results.metadatas) {
          results.metadatas.forEach((metadata: any) => {
            if (metadata.source) {
              sources.add(metadata.source);
            }
          });
        }

        return {
          count: results.ids?.length || 0,
          sources: Array.from(sources)
        };
      } catch (error) {
        console.warn('ChromaDB stats failed, falling back to memory:', error);
        return this.getMemoryStats();
      }
    } else {
      return this.getMemoryStats();
    }
  }

  private getMemoryStats(): { count: number; sources: string[] } {
    const sources = new Set<string>();
    
    for (const chunk of this.chunks.values()) {
      if (chunk.metadata.source) {
        sources.add(chunk.metadata.source);
      }
    }

    return {
      count: this.chunks.size,
      sources: Array.from(sources)
    };
  }

  async deleteBySource(source: string): Promise<void> {
    if (this.collection) {
      try {
        const results = await this.collection.get({
          where: { source: { $eq: source } }
        });

        if (results.ids && results.ids.length > 0) {
          await this.collection.delete({
            ids: results.ids
          });
        }
      } catch (error) {
        console.warn('ChromaDB deleteBySource failed, falling back to memory:', error);
        this.deleteFromMemoryBySource(source);
      }
    } else {
      this.deleteFromMemoryBySource(source);
    }
  }

  private deleteFromMemoryBySource(source: string): void {
    const toDelete: string[] = [];
    
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.metadata.source === source) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.chunks.delete(id);
    }
  }

  async refreshIndex(): Promise<void> {
    if (this.collection) {
      try {
        await this.collection.delete({
          where: {}
        });
      } catch (error) {
        console.warn('ChromaDB refresh failed, falling back to memory:', error);
        this.chunks.clear();
      }
    } else {
      this.chunks.clear();
    }
  }
}
