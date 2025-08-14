import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

@Injectable()
export class CriticAgentService implements OnModuleInit {
  private readonly logger = new Logger(CriticAgentService.name);
  private agentExecutor: AgentExecutor | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeAgent();
  }

  private async initializeAgent(): Promise<void> {
    try {
      const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!googleApiKey) {
        this.logger.error('GEMINI_API_KEY is not set');
        return;
      }

      const model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        model: 'gemini-2.0-flash',
        temperature: 0.1,
        maxOutputTokens: 8192,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are a professional financial editor and quality assurance specialist. Your job is to critically evaluate a financial report for a specific stock ticker.

          Your task:
          1. Review the provided report against the original analysis data and news.
          2. Check for factual consistency, objectivity, and proper formatting.
          3. Provide a clear verdict: "PASS" if the report is satisfactory, or "FAIL" if it needs revision.
          4. If you "FAIL" the report, provide specific, actionable feedback on what needs to be corrected.

          You must be strict and objective. Do not pass a report that contains inconsistencies or is poorly formatted.`,
        ],
        new MessagesPlaceholder('agent_scratchpad'),
        ['human', '{input}'],
      ]);

      const agent = createToolCallingAgent({
        llm: model,
        tools: [],
        prompt,
      });
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: [],
        verbose: this.configService.get('NODE_ENV') === 'development',
        returnIntermediateSteps:
          this.configService.get('NODE_ENV') === 'development',
      });

      this.isInitialized = true;
      this.logger.log('Critic Agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Critic agent:', error.message);
      this.isInitialized = false;
    }
  }

  async critiqueReport(
    report: string,
    dataAnalysis: any,
    newsAnalysis: any,
    memory: Record<string, any>,
  ): Promise<{ verdict: 'PASS' | 'FAIL'; feedback?: string }> {
    if (!this.isInitialized || !this.agentExecutor) {
      await this.initializeAgent();
      if (!this.isInitialized) {
        return { verdict: 'FAIL', feedback: 'Agent initialization failed' };
      }
    }

    const input = `
      Please provide a constructive review of the following financial report. Evaluate its accuracy, clarity, and adherence to the source data.

      ### Report to Review:
      ${report}

      ### Original Data Analysis:
      ${JSON.stringify(dataAnalysis, null, 2)}

      ### Original News Analysis:
      ${JSON.stringify(newsAnalysis, null, 2)}
      
      ### Previous Analysis Memory:
      ${JSON.stringify(memory, null, 2)}

      Based on your review, provide a verdict ('PASS' or 'REVISE') and detailed feedback.
    `;

    const result = await this.agentExecutor.invoke({ input });
    const output = result.output as string;

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
