#!/usr/bin/env tsx

import { loadConfig } from '../config.js';
import { RAGService } from '../services/ragService.js';

async function testRAGService() {
  console.log('🧪 Testing RAG Service...\n');

  const config = loadConfig('./config.json');
  const ragService = new RAGService(config);

  try {
    console.log('1. Initializing RAG service...');
    await ragService.initialize();
    console.log('✅ RAG service initialized\n');

    console.log('2. Checking Ollama connection...');
    const isConnected = await ragService.checkOllamaConnection();
    if (!isConnected) {
      console.log('⚠️  Ollama not connected. Using simple text-based search\n');
    } else {
      console.log('✅ Ollama connected\n');
    }

    if (isConnected) {
      console.log('3. Ensuring model availability...');
      await ragService.ensureOllamaReady();
      console.log('✅ Model ready\n');
    }

    console.log('4. Running document ingestion...');
    const result = await ragService.ingestDocuments();
    console.log(`✅ Ingested ${result.chunks} chunks from ${result.processed} documents\n`);

    console.log('5. Getting collection summary...');
    const summary = await ragService.getCollectionSummary();
    console.log('📊 Collection Summary:');
    console.log(`   Total chunks: ${summary.totalChunks}`);
    console.log(`   Total sources: ${summary.totalSources}`);
    console.log(`   Sources: ${summary.sources.join(', ')}\n`);

    if (summary.totalChunks > 0) {
      console.log('6. Testing search...');
      const searchResults = await ragService.search('MCP RAG server', 3);
      console.log(`✅ Found ${searchResults.length} results for search query\n`);
      
      if (searchResults.length > 0) {
        console.log('7. Testing get_chunk...');
        const firstChunk = searchResults[0];
        const retrievedChunk = await ragService.getChunk(firstChunk.id);
        if (retrievedChunk) {
          console.log('✅ Successfully retrieved chunk by ID');
          console.log(`   Chunk ID: ${retrievedChunk.id}`);
          console.log(`   Content preview: ${retrievedChunk.content.substring(0, 100)}...\n`);
        }
      }
    }

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testRAGService().catch(console.error);
}
