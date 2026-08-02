import { z } from 'zod';

export const writerReportSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z
          .string()
          .describe(
            'Section heading, e.g. "Executive Summary", "Technical Analysis".',
          ),
        content: z
          .string()
          .describe('Markdown content of the section (no heading itself).'),
      }),
    )
    .min(1)
    .describe('Ordered sections making up the report.'),
  overallSentiment: z
    .enum(['positive', 'negative', 'neutral'])
    .describe('Overall sentiment conveyed by the report.'),
  priceTrend: z
    .enum(['up', 'down', 'flat'])
    .describe('Overall price trend observed over the analyzed period.'),
});

export type WriterReport = z.infer<typeof writerReportSchema>;

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisRequest {
  ticker: string;
  date: string;
  archivistReport?: string;
  additionalContext?: string;
}

export interface DataAnalysisResult {
  stockData: any;
  technicalIndicators: any;
  historicalTrends: any;
  dataRetrievalStatus: {
    success: boolean;
    toolsUsed: string[];
    errors: string[];
  };
}

export interface NewsAnalysisResult {
  articles: any[];
  sentiment: string;
  keyEvents: string[];
  searchStatus: {
    success: boolean;
    toolsUsed: string[];
    articlesFound: number;
    errors: string[];
  };
}

export interface FinalReport {
  summary: string;
  newsImpact: string[];
  sentiment: string;
  recommendations?: string[];
}

export interface PortfolioItem {
  ticker: string;
  shares: number;
  currentPrice: number;
  valueInEUR: number;
}
