import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RAGService } from '../services/ragService.js';

export function createTools(ragService: RAGService): Tool[] {
  return [
    {
      name: 'ingest_docs',
      description: 'Ingest documents from a directory into the RAG system',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory containing documents to ingest (optional, uses config default if not provided)'
          }
        }
      }
    },
    {
      name: 'search',
      description: 'Search for relevant document chunks using semantic similarity',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant document chunks'
          },
          k: {
            type: 'number',
            description: 'Number of top results to return (default: 5)',
            default: 5
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_chunk',
      description: 'Retrieve a specific document chunk by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique identifier of the chunk to retrieve'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'refresh_index',
      description: 'Clear and refresh the entire document index',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];
}

export async function handleToolCall(toolName: string, args: any, ragService: RAGService): Promise<any> {
  switch (toolName) {
    case 'ingest_docs':
      const result = await ragService.ingestDocuments(args.path);
      return {
        success: true,
        message: `Successfully processed ${result.processed} documents and created ${result.chunks} chunks`,
        processed: result.processed,
        chunks: result.chunks
      };

    case 'search':
      const chunks = await ragService.search(args.query, args.k || 5);
      return {
        success: true,
        results: chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          uri: `rag://doc/${chunk.metadata.source}#${chunk.id}`
        }))
      };

    case 'get_chunk':
      const chunk = await ragService.getChunk(args.id);
      if (!chunk) {
        return {
          success: false,
          error: 'Chunk not found'
        };
      }
      return {
        success: true,
        chunk: {
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          uri: `rag://doc/${chunk.metadata.source}#${chunk.id}`
        }
      };

    case 'refresh_index':
      await ragService.refreshIndex();
      return {
        success: true,
        message: 'Index refreshed successfully'
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
