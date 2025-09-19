import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { RAGService } from '../services/ragService.js';

export function createResources(ragService: RAGService): Resource[] {
  return [
    {
      uri: 'rag://collection/summary',
      name: 'Collection Summary',
      description: 'Summary of the document collection including statistics and available sources',
      mimeType: 'application/json'
    }
  ];
}

export async function handleResourceRead(uri: string, ragService: RAGService): Promise<string> {
  if (uri === 'rag://collection/summary') {
    const summary = await ragService.getCollectionSummary();
    return JSON.stringify(summary, null, 2);
  }

  if (uri.startsWith('rag://doc/')) {
    const parts = uri.split('#');
    if (parts.length === 2) {
      const chunkId = parts[1];
      const chunk = await ragService.getChunk(chunkId);
      if (chunk) {
        return JSON.stringify({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          uri: uri
        }, null, 2);
      }
    }
  }

  throw new Error(`Resource not found: ${uri}`);
}

export function isResourceUri(uri: string): boolean {
  return uri.startsWith('rag://');
}
