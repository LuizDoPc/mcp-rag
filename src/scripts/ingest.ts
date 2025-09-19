#!/usr/bin/env tsx

import { loadConfig, createDefaultConfig } from '../config.js';
import { RAGService } from '../services/ragService.js';

async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find(arg => arg.startsWith('--config='))?.split('=')[1];
  const directoryPath = args.find(arg => !arg.startsWith('--'));
  const createConfig = args.includes('--create-config');

  if (createConfig) {
    createDefaultConfig();
    return;
  }

  const config = loadConfig(configPath);
  const ragService = new RAGService(config);

  try {
    console.log('Initializing RAG service...');
    await ragService.initialize();

    console.log('Checking Ollama connection...');
    const isConnected = await ragService.checkOllamaConnection();
    if (!isConnected) {
      console.log(`⚠️  Ollama not connected at ${config.ollamaUrl}`);
      console.log('Using simple text-based search (no embeddings)');
    } else {
      console.log('Ensuring embedding model is available...');
      await ragService.ensureOllamaReady();
    }

    console.log('Starting document ingestion...');
    const result = await ragService.ingestDocuments(directoryPath);
    
    console.log('✅ Ingestion completed successfully!');
    console.log(`📄 Processed ${result.processed} documents`);
    console.log(`📝 Created ${result.chunks} chunks`);

    const summary = await ragService.getCollectionSummary();
    console.log('\n📊 Collection Summary:');
    console.log(`   Total chunks: ${summary.totalChunks}`);
    console.log(`   Total sources: ${summary.totalSources}`);
    console.log(`   File types: ${JSON.stringify(summary.stats.fileTypes)}`);

  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
