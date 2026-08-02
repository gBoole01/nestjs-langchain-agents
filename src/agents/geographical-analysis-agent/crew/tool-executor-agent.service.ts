import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { StructuredToolInterface } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentExecutor,
  createToolCallingAgent,
} from '@langchain/classic/agents';
import { SerperNewsTool } from 'src/tools/serper/serper-news.tool';
import { WebScrapingTool } from 'src/tools/web-scraping/web-scraping.tool';

@Injectable()
export class ToolExecutorAgent implements OnModuleInit {
  private readonly logger = new Logger(ToolExecutorAgent.name);
  private agentExecutor: AgentExecutor;

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
    });

    const tools: StructuredToolInterface[] = [
      this.serperNewsTool.getTool(),
      this.webScrapingTool.getTool(),
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a highly skilled research assistant specialized in regional and geopolitical economic research.
        Your sole purpose is to retrieve high-quality, relevant data about a specific geographical area's economic outlook (growth, inflation, trade, fiscal/monetary policy, geopolitical risk).
        Your workflow is to first search for relevant information using a search tool, then use a web scraping tool on promising links to get detailed content.
        Your final output must be the raw, aggregated text content.`,
      ],
      new MessagesPlaceholder('agent_scratchpad'),
      ['human', '{input}'],
    ]);

    const agent = createToolCallingAgent({ llm: model, tools, prompt });
    this.agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: this.configService.get('VERBOSE') === 'true',
    });
  }

  public async executeTools(query: string): Promise<string> {
    const result = await this.agentExecutor.invoke({ input: query });
    this.logger.log('Tool execution complete.');
    this.logger.log(`Tool output: ${result.output}`);
    return result.output;
  }
}
