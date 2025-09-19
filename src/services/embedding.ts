import axios from 'axios';
import { Config } from '../config.js';

export class EmbeddingService {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.config.ollamaUrl}/api/embeddings`, {
        model: this.config.embeddingModel,
        prompt: text
      });

      if (!response.data.embedding) {
        throw new Error('No embedding returned from Ollama');
      }

      return response.data.embedding;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to Ollama at ${this.config.ollamaUrl}. Please ensure Ollama is running and the nomic-embed-text model is installed.`);
        }
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  async checkOllamaConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.ollamaUrl}/api/tags`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async ensureModelAvailable(): Promise<void> {
    try {
      const response = await axios.get(`${this.config.ollamaUrl}/api/tags`);
      const models = response.data.models || [];
      const modelExists = models.some((model: any) => model.name.includes(this.config.embeddingModel));
      
      if (!modelExists) {
        console.log(`Model ${this.config.embeddingModel} not found. Pulling...`);
        await axios.post(`${this.config.ollamaUrl}/api/pull`, {
          name: this.config.embeddingModel
        });
        console.log(`Model ${this.config.embeddingModel} pulled successfully.`);
      }
    } catch (error) {
      throw new Error(`Failed to ensure model availability: ${error}`);
    }
  }
}
