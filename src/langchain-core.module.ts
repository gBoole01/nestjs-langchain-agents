import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChromaClient } from 'chromadb';
import { MongoClient } from 'mongodb';

export const GEOGRAPHICAL_VECTOR_STORE = 'GEOGRAPHICAL_VECTOR_STORE';
export const SECTORIAL_VECTOR_STORE = 'SECTORIAL_VECTOR_STORE';

/**
 * Each domain (global/geographical/sectorial) archives into its own Chroma
 * collection in dev and its own Mongo collection (default collection name
 * suffixed by domain) in production, so retrieval for one domain never
 * surfaces another domain's reports.
 */
function createVectorStoreProvider(
  token: string | typeof VectorStore,
  chromaCollectionName: string,
  mongoCollectionSuffix: string,
): Provider {
  return {
    provide: token,
    useFactory: async (configService: ConfigService) => {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: configService.get<string>('GEMINI_API_KEY'),
      });

      if (process.env.NODE_ENV === 'production') {
        const mongoModule = await import('@langchain/mongodb');
        const client = new MongoClient(configService.get<string>('MONGO_URI'));
        const collection = client
          .db(configService.get<string>('MONGO_DB_NAME'))
          .collection(
            `${configService.get<string>('MONGO_COLLECTION_NAME')}_${mongoCollectionSuffix}`,
          );
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
          collectionName: chromaCollectionName,
        });
      }
    },
    inject: [ConfigService],
  };
}

@Module({
  imports: [ConfigModule],
  providers: [
    createVectorStoreProvider(VectorStore, 'economic_reports', 'global'),
    createVectorStoreProvider(
      GEOGRAPHICAL_VECTOR_STORE,
      'geographical_reports',
      'geographical',
    ),
    createVectorStoreProvider(
      SECTORIAL_VECTOR_STORE,
      'sectorial_reports',
      'sectorial',
    ),
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
  exports: [
    VectorStore,
    GEOGRAPHICAL_VECTOR_STORE,
    SECTORIAL_VECTOR_STORE,
    Embeddings,
    GoogleGenerativeAIEmbeddings,
  ],
})
export class LangchainCoreModule {}
