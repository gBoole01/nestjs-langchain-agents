import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { TavilySearch } from '@langchain/tavily';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataAnalystAgentService } from './crew/data-analyst-agent.service';
import { DataAnalystTool } from './tools/data-analyst.tool';

@Injectable()
export class StockAnalysisAgentGraphService implements OnModuleInit {
  private googleApiKey: string;
  private geminiModel: string;
  private readonly logger = new Logger(StockAnalysisAgentGraphService.name);
  private agent: any | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataAnalystAgent: DataAnalystAgentService,
  ) {
    this.googleApiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.geminiModel = this.configService.get<string>('GEMINI_MODEL');
  }

  async onModuleInit() {
    await this.initializeAgent();
    this.logger.log('Orchestrator Agent initialized');
  }

  private async initializeAgent() {
    try {
      const agentTools = [
        new TavilySearch({ maxResults: 3 }),
        new DataAnalystTool(this.dataAnalystAgent),
      ];
      const toolNode = new ToolNode(agentTools);
      const workflow = new StateGraph(MessagesAnnotation)
        .addNode('orchestrator', (state) => this.callOrchestrator(state))
        .addEdge('__start__', 'orchestrator')
        .addNode('tools', toolNode)
        .addEdge('tools', 'orchestrator')
        .addConditionalEdges('orchestrator', (state) =>
          this.shouldContinue(state),
        );
      this.agent = workflow.compile();
      this.logger.log('Stock Analysis Agent initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Stock Analysis agent:',
        error.message,
      );
    }
  }

  async runAgent(ticker: string): Promise<void> {
    if (!this.agent) {
      this.logger.warn('Agent is not initialized. Cannot run agent.');
      return;
    }

    try {
      this.logger.log('Testing agent with sample query...');
      const result = await this.agent.invoke({
        messages: [new HumanMessage(`What's the latest price for ${ticker}?`)],
      });
      console.log(result);
    } catch (error) {
      this.logger.error('Agent test failed:', error.message);
    }
  }

  shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    console.log('shouldContinue');
    console.log(messages);
    const lastMessage = messages[messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) {
      return 'tools';
    }
    return '__end__';
  }

  async callOrchestrator(state: typeof MessagesAnnotation.State) {
    const model = new ChatGoogleGenerativeAI({
      apiKey: this.googleApiKey,
      model: this.geminiModel,
      temperature: 0.1,
      maxOutputTokens: 8192,
    });
    const modelWithTools = model.bindTools([
      new DataAnalystTool(this.dataAnalystAgent),
    ]);

    const systemPrompt = `You are a financial orchestrator agent. Your primary goal is to answer questions about stock performance by leveraging specialized tools.
  
  **Instructions:**
  - When asked about specific stock data, like performance or price trends, always prioritize using the \`data_analyst\` tool.
  - For general knowledge questions or information not related to stock analysis, you can answer directly.
  - If a user asks for general market information or news, use the \`tavily_search_results_json\` tool to find relevant information.`;

    const updatedMessages = [new HumanMessage(systemPrompt), ...state.messages];

    const response = await modelWithTools.invoke(updatedMessages);
    return { messages: [response] };
  }
}
