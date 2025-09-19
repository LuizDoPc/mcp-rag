import { readFileSync, statSync } from 'fs';
import { extname, basename } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
// import pdf from 'pdf-parse';
import { encoding_for_model } from 'tiktoken';
import { Config } from '../config.js';
import { DocumentChunk } from './vectorStore.js';

export class DocumentProcessor {
  private config: Config;
  private tokenizer: any;

  constructor(config: Config) {
    this.config = config;
    this.tokenizer = encoding_for_model('gpt-4');
  }

  async processDirectory(directoryPath: string): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];
    
    try {
      const files = await glob(`${directoryPath}/**/*.{pdf,md,txt}`, {
        ignore: ['node_modules/**', '.git/**']
      });

      for (const filePath of files) {
        try {
          const chunks = await this.processFile(filePath);
          allChunks.push(...chunks);
        } catch (error) {
          console.warn(`Failed to process file ${filePath}:`, error);
        }
      }
    } catch (error) {
      throw new Error(`Failed to process directory ${directoryPath}: ${error}`);
    }

    return allChunks;
  }

  async processFile(filePath: string): Promise<DocumentChunk[]> {
    const extension = extname(filePath).toLowerCase();
    const fileName = basename(filePath);
    
    let content: string;
    let metadata: any = {};

    try {
      switch (extension) {
        case '.pdf':
          try {
            const pdf = (await import('pdf-parse')).default;
            const pdfBuffer = readFileSync(filePath);
            const pdfData = await pdf(pdfBuffer);
            content = pdfData.text;
            metadata = {
              title: pdfData.info?.Title || fileName,
              pages: pdfData.numpages
            };
          } catch (error) {
            throw new Error(`Failed to parse PDF: ${error}`);
          }
          break;
        
        case '.md':
          const mdContent = readFileSync(filePath, 'utf-8');
          const parsed = matter(mdContent);
          content = parsed.content;
          metadata = {
            title: parsed.data.title || fileName,
            ...parsed.data
          };
          break;
        
        case '.txt':
          content = readFileSync(filePath, 'utf-8');
          metadata = { title: fileName };
          break;
        
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }

    const chunks = this.chunkText(content, filePath, metadata);
    return chunks;
  }

  private chunkText(text: string, source: string, metadata: any): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const tokens = this.tokenizer.encode(text);
    
    let start = 0;
    let chunkIndex = 0;
    
    while (start < tokens.length) {
      const end = Math.min(start + this.config.chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      const chunkText = new TextDecoder().decode(this.tokenizer.decode(chunkTokens));
      
      if (typeof chunkText !== 'string' || !chunkText || chunkText.trim().length === 0) {
        start = end;
        continue;
      }

      const chunkId = `${source.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${chunkIndex}`;
      
      chunks.push({
        id: chunkId,
        content: chunkText.trim(),
        metadata: {
          source,
          chunkIndex,
          totalChunks: Math.ceil(tokens.length / this.config.chunkSize),
          title: metadata.title,
          page: metadata.page
        }
      });

      start = Math.max(start + 1, end - this.config.chunkOverlap);
      chunkIndex++;
    }

    return chunks;
  }

  async getFileStats(directoryPath: string): Promise<{ totalFiles: number; totalSize: number; fileTypes: Record<string, number> }> {
    try {
      const files = await glob(`${directoryPath}/**/*.{pdf,md,txt}`, {
        ignore: ['node_modules/**', '.git/**']
      });

      let totalSize = 0;
      const fileTypes: Record<string, number> = {};

      for (const filePath of files) {
        try {
          const stats = statSync(filePath);
          totalSize += stats.size;
          
          const ext = extname(filePath).toLowerCase();
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        } catch (error) {
          console.warn(`Failed to get stats for ${filePath}:`, error);
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        fileTypes
      };
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error}`);
    }
  }
}
