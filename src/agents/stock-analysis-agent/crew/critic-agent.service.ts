import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { WriterReport } from '../stock-analysis-agent.types';

export interface CritiqueReportInput {
  report: WriterReport;
  dataAnalysis: any;
  newsAnalysis: any;
  archivistReport: string;
  globalReport: string;
  geoReport: string;
  sectorReport: string;
}

@Injectable()
export class CriticAgentService implements OnModuleInit {
  private readonly logger = new Logger(CriticAgentService.name);
  private agent;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
      const geminiModel = this.configService.get<string>('GEMINI_MODEL');
      if (!googleApiKey) {
        this.logger.error('GEMINI_API_KEY is not set');
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: geminiModel,
        temperature: 0.1,
        maxOutputTokens: 8192,
        maxRetries: 8,
        onFailedAttempt: geminiOnFailedAttempt,
      });

      this.agent = createAgent({
        model,
        tools: [],
        systemPrompt: `You are a professional financial editor and quality assurance specialist. Your job is to critically evaluate a financial report for a specific stock ticker.

The report is provided as JSON with a "sections" array (each with a "heading" and "content"), an "overallSentiment" (positive/negative/neutral), and a "priceTrend" (up/down/flat).

Your task:
1. Review the provided report against the original analysis data and news.
2. Check for factual consistency, objectivity, and proper formatting.
3. Check that "overallSentiment" and "priceTrend" are actually justified by the section content and source data.
4. Provide a clear verdict: "PASS" if the report is satisfactory, or "FAIL" if it needs revision.
5. If you "FAIL" the report, provide specific, actionable feedback on what needs to be corrected.

You must be strict and objective. Do not pass a report that contains inconsistencies or is poorly formatted.`,
      });

      this.isInitialized = true;
      this.logger.log('Critic Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Critic agent:', error.message);
      this.isInitialized = false;
    }
  }

  async critiqueReport(
    input: CritiqueReportInput,
  ): Promise<{ verdict: 'PASS' | 'FAIL'; feedback?: string }> {
    if (!this.isInitialized || !this.agent) {
      await this.initializeAgent();
      if (!this.isInitialized) {
        return { verdict: 'FAIL', feedback: 'Agent initialization failed' };
      }
    }

    const {
      report,
      dataAnalysis,
      newsAnalysis,
      archivistReport,
      globalReport,
      geoReport,
      sectorReport,
    } = input;

    const promptInput = `
      Please provide a constructive review of the following financial report. Evaluate its accuracy, clarity, and adherence to the source data (including the broader global/regional/sector context, which is also a valid source).

      ### Report to Review:
      ${JSON.stringify(report, null, 2)}

      ### Original Data Analysis:
      ${JSON.stringify(dataAnalysis, null, 2)}

      ### Original News Analysis:
      ${JSON.stringify(newsAnalysis, null, 2)}

      ### Archivist Report:
      ${archivistReport}

      ### Global Economic Context:
      ${globalReport}

      ### Regional/Geographical Context:
      ${geoReport}

      ### Sector Context:
      ${sectorReport}

      Based on your review, provide a verdict ('PASS' or 'REVISE') and detailed feedback.
    `;

    const result = await this.agent.invoke({
      messages: [{ role: 'user', content: promptInput }],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    const output =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // Simple parsing logic to extract verdict and feedback
    if (output.toUpperCase().includes('PASS')) {
      return { verdict: 'PASS' };
    }

    const feedbackMatch = output.match(/Feedback:\s*([\s\S]*)/i);
    return {
      verdict: 'FAIL',
      feedback: feedbackMatch
        ? feedbackMatch[1].trim()
        : 'No specific feedback provided.',
    };
  }
}
