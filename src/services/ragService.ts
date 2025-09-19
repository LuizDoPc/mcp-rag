import { EmbeddingService } from './embedding.js';
import { VectorStore, DocumentChunk } from './vectorStore.js';
import { DocumentProcessor } from './documentProcessor.js';
import { Config } from '../config.js';
import { resolve } from 'path';

export class RAGService {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private documentProcessor: DocumentProcessor;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.embeddingService = new EmbeddingService(config);
    this.vectorStore = new VectorStore(config, this.embeddingService);
    this.documentProcessor = new DocumentProcessor(config);
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }

  async ingestDocuments(directoryPath?: string): Promise<{ processed: number; chunks: number }> {
    const path = directoryPath || this.config.documentsPath;
    
    // Resolve path relative to the project root, not the current working directory
    const absolutePath = path.startsWith('/') ? path : resolve(process.cwd(), path);
    
    console.error(`Processing documents from: ${path}`);
    console.error(`Absolute path: ${absolutePath}`);
    
    let chunks;
    try {
      chunks = await this.documentProcessor.processDirectory(absolutePath);
      console.error(`Document processor returned ${chunks.length} chunks`);
      
      if (chunks.length === 0) {
        console.error('No documents found to process');
        return { processed: 0, chunks: 0 };
      }
    } catch (error) {
      console.error('Error in document processing:', error);
      throw error;
    }

    console.error(`Generated ${chunks.length} chunks from documents`);
    
    const uniqueSources = new Set(chunks.map(chunk => chunk.metadata.source));
    console.error(`Processing ${uniqueSources.size} unique documents`);

    for (const source of uniqueSources) {
      await this.vectorStore.deleteBySource(source);
    }

    await this.vectorStore.addDocuments(chunks);
    
    console.error(`Successfully ingested ${chunks.length} chunks from ${uniqueSources.size} documents`);
    return { processed: uniqueSources.size, chunks: chunks.length };
  }

  async search(query: string, k: number = 5): Promise<DocumentChunk[]> {
    return await this.vectorStore.search(query, k);
  }

  async getChunk(id: string): Promise<DocumentChunk | null> {
    return await this.vectorStore.getChunk(id);
  }

  async refreshIndex(): Promise<void> {
    await this.vectorStore.refreshIndex();
  }

  async getCollectionSummary(): Promise<{
    totalChunks: number;
    totalSources: number;
    sources: string[];
    stats: any;
  }> {
    const stats = await this.vectorStore.getCollectionStats();
    const fileStats = await this.documentProcessor.getFileStats(this.config.documentsPath);
    
    return {
      totalChunks: stats.count,
      totalSources: stats.sources.length,
      sources: stats.sources,
      stats: fileStats
    };
  }

  async checkOllamaConnection(): Promise<boolean> {
    return await this.embeddingService.checkOllamaConnection();
  }

  async ensureOllamaReady(): Promise<void> {
    const isConnected = await this.embeddingService.checkOllamaConnection();
    if (!isConnected) {
      throw new Error(`Cannot connect to Ollama at ${this.config.ollamaUrl}. Please ensure Ollama is running.`);
    }
    
    await this.embeddingService.ensureModelAvailable();
  }
}
