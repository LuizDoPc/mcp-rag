#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { RAGService } from './services/ragService.js';
import { createTools, handleToolCall } from './mcp/tools.js';
import { createResources, handleResourceRead, isResourceUri } from './mcp/resources.js';

async function main() {
  try {
    const config = loadConfig('./config.json');
    const ragService = new RAGService(config);

    await ragService.initialize();
    console.error('RAG service initialized successfully');

    // Automatically ingest documents on startup
    console.error('Starting automatic document ingestion...');
    try {
      const result = await ragService.ingestDocuments();
      console.error(`Auto-ingestion completed: ${result.processed} documents processed, ${result.chunks} chunks created`);
    } catch (error) {
      console.error('Auto-ingestion failed:', error);
    }

    const server = new Server(
      {
        name: config.mcpServer?.name || 'mcp-rag-server',
        version: config.mcpServer?.version || '1.0.0'
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: createTools(ragService)
      };
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: createResources(ragService)
      };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (!isResourceUri(uri)) {
        throw new Error(`Invalid resource URI: ${uri}`);
      }

      const content = await handleResourceRead(uri, ragService);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: content
          }
        ]
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await handleToolCall(name, args || {}, ragService);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('MCP RAG Server running on stdio');
  } catch (error) {
    console.error('Failed to initialize RAG service:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
