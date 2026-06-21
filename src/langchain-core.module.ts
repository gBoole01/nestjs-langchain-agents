import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChromaClient } from 'chromadb';
import { MongoClient } from 'mongodb';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: VectorStore,
      useFactory: async (configService: ConfigService) => {
        const embeddings = new GoogleGenerativeAIEmbeddings({
          apiKey: configService.get<string>('GEMINI_API_KEY'),
        });

        if (process.env.NODE_ENV === 'production') {
          const mongoModule = await import('@langchain/mongodb');
          const client = new MongoClient(
            configService.get<string>('MONGO_URI'),
          );
          const collection = client
            .db(configService.get<string>('MONGO_DB_NAME'))
            .collection(configService.get<string>('MONGO_COLLECTION_NAME'));
          return new mongoModule.MongoDBAtlasVectorSearch(embeddings, {
            collection,
          });
        } else {
          const { Chroma } = await import(
            '@langchain/community/vectorstores/chroma'
          );
          const chromaClient = new ChromaClient({
            path: 'http://localhost:8000',
          });
          return new Chroma(embeddings, {
            index: chromaClient,
            collectionName: 'economic_reports',
          });
        }
      },
      inject: [ConfigService],
    },
    {
      provide: Embeddings,
      useFactory: (configService: ConfigService) =>
        new GoogleGenerativeAIEmbeddings({
          apiKey: configService.get<string>('GEMINI_API_KEY'),
        }),
      inject: [ConfigService],
    },
    {
      provide: GoogleGenerativeAIEmbeddings,
      useFactory: (configService: ConfigService) =>
        new GoogleGenerativeAIEmbeddings({
          apiKey: configService.get<string>('GEMINI_API_KEY'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [VectorStore, Embeddings, GoogleGenerativeAIEmbeddings],
})
export class LangchainCoreModule {}
