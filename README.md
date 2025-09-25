# MCP RAG Server

A Model Context Protocol (MCP) server that provides RAG (Retrieval-Augmented Generation) functionality using local embeddings via Ollama and Chroma vector database.

[Presentation link](https://docs.google.com/presentation/d/1qcE-Ya1074sRvpCh_g0oYFFW9PSr0jDkXO0mJnrL7E0/edit?usp=sharing)

## Features

- **Local Processing**: No external API costs - runs entirely locally
- **Multiple Formats**: Supports PDF, Markdown, and TXT files
- **Smart Chunking**: Configurable chunk size with overlap for better context
- **Vector Search**: Semantic search using nomic-embed-text model via Ollama
- **MCP Integration**: Works seamlessly with Cursor and other MCP clients

## Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (for ChromaDB)
- **Homebrew** (for Ollama on macOS)

## 🚀 Quick Start

### Setup (one time)

```bash
npm run setup
```

This will:
- Start Ollama and install nomic-embed-text model
- Start ChromaDB with Docker
- Build the project
- Ingest documents from `./docs`

### Development

```bash
# Start MCP server
npm run dev

# Ingest new documents
npm run ingest
```

### Stop Services

```bash
npm run stop
```

## Configuration

The server uses a `config.json` file for configuration:

```json
{
  "documentsPath": "./docs",
  "chunkSize": 1000,
  "chunkOverlap": 200,
  "ollamaUrl": "http://localhost:11434",
  "embeddingModel": "nomic-embed-text",
  "chromaUrl": "http://localhost:8001",
  "collectionName": "rag_documents",
  "mcpServer": {
    "name": "mcp-rag-server",
    "version": "1.0.0"
  }
}
```

## MCP Tools

- `ingest_docs({path?})` - Ingest documents from a directory
- `search({query, k?})` - Search for relevant document chunks
- `get_chunk({id})` - Retrieve a specific chunk by ID
- `refresh_index()` - Clear and refresh the entire index

## MCP Resources

- `rag://collection/summary` - Collection statistics and metadata
- `rag://doc/<filename>#<chunk_id>` - Individual document chunks

## Configure in Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "rag-server": {
      "command": "node",
      "args": ["/Users/luizsoares/Documents/buildaz/mcp_rag/dist/index.js"],
      "env": {}
    }
  }
}
```

## Available Scripts

- `npm run setup` - Complete setup (Ollama + ChromaDB + build + ingest)
- `npm run dev` - Start MCP server in development mode
- `npm run ingest` - Ingest documents
- `npm run build` - Build the project
- `npm run test` - Run tests
- `npm run stop` - Stop all services

## Troubleshooting

1. **Ollama Connection Issues**: Ensure Ollama is running on the configured URL
2. **Model Not Found**: Run `ollama pull nomic-embed-text` to install the embedding model
3. **Docker Issues**: Ensure Docker is running and accessible