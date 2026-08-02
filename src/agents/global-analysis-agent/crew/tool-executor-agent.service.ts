import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent } from 'langchain';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { SerperNewsTool } from 'src/tools/serper/serper-news.tool';
import { WebScrapingTool } from 'src/tools/web-scraping/web-scraping.tool';

@Injectable()
export class ToolExecutorAgent implements OnModuleInit {
  private readonly logger = new Logger(ToolExecutorAgent.name);
  private agent;

  constructor(
    private readonly configService: ConfigService,
    private readonly serperNewsTool: SerperNewsTool,
    private readonly webScrapingTool: WebScrapingTool,
  ) {}

  async onModuleInit() {
    this.initializeAgent();
    this.logger.log('Tool Executor Agent initialized successfully.');
  }

  private initializeAgent(): void {
    const googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = new ChatGoogleGenerativeAI({
      apiKey: googleApiKey,
      model: this.configService.get<string>('GEMINI_MODEL'),
      temperature: 0.1,
      maxRetries: 8,
      onFailedAttempt: geminiOnFailedAttempt,
    });

    this.agent = createAgent({
      model,
      tools: [this.serperNewsTool.getTool(), this.webScrapingTool.getTool()],
      systemPrompt: `You are a highly skilled research assistant. Your sole purpose is to retrieve high-quality, relevant data from the internet.
Your workflow is to first search for relevant information using a search tool, then use a web scraping tool on promising links to get detailed content.
Your final output must be the raw, aggregated text content.`,
    });
  }

  public async executeTools(query: string): Promise<string> {
    const result = await this.agent.invoke({
      messages: [{ role: 'user', content: query }],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    const output =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    this.logger.log('Tool execution complete.');
    this.logger.log(`Tool output: ${output}`);
    return output;
  }
}
