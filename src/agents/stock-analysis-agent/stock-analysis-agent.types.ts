export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisRequest {
  ticker: string;
  date: string;
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
