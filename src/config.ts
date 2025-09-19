import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

const ConfigSchema = z.object({
  documentsPath: z.string().default('./docs'),
  chunkSize: z.number().default(1000),
  chunkOverlap: z.number().default(200),
  ollamaUrl: z.string().default('http://localhost:11434'),
  embeddingModel: z.string().default('nomic-embed-text'),
  chromaUrl: z.string().default('http://localhost:8001'),
  collectionName: z.string().default('rag_documents'),
  mcpServer: z.object({
    name: z.string().default('mcp-rag-server'),
    version: z.string().default('1.0.0')
  }).optional()
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath?: string): Config {
  const defaultConfig: Config = {
    documentsPath: './docs',
    chunkSize: 1000,
    chunkOverlap: 200,
    ollamaUrl: 'http://localhost:11434',
    embeddingModel: 'nomic-embed-text',
    chromaUrl: 'http://localhost:8001',
    collectionName: 'rag_documents',
    mcpServer: {
      name: 'mcp-rag-server',
      version: '1.0.0'
    }
  };

  if (!configPath) {
    return defaultConfig;
  }

  try {
    const configFile = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configFile);
    return ConfigSchema.parse({ ...defaultConfig, ...userConfig });
  } catch (error) {
    console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
    return defaultConfig;
  }
}

export function createDefaultConfig(): void {
  const defaultConfig = {
    documentsPath: './docs',
    chunkSize: 1000,
    chunkOverlap: 200,
    ollamaUrl: 'http://localhost:11434',
    embeddingModel: 'nomic-embed-text',
    chromaUrl: 'http://localhost:8001',
    collectionName: 'rag_documents',
    mcpServer: {
      name: 'mcp-rag-server',
      version: '1.0.0'
    }
  };

  const configPath = './config.json';
  try {
    require('fs').writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Default config created at ${configPath}`);
  } catch (error) {
    console.error('Failed to create default config:', error);
  }
}
