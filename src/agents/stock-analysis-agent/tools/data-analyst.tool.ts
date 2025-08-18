import { Tool } from '@langchain/core/tools';
import { DataAnalystAgentService } from '../crew/data-analyst-agent.service';

export class DataAnalystTool extends Tool {
  name = 'data_analyst';
  description =
    'A tool to perform detailed technical and financial analysis on stock data.';

  constructor(private readonly dataAnalystService: DataAnalystAgentService) {
    super();
  }

  async _call(input: string): Promise<string> {
    const [ticker] = input.split(',');
    const date = new Date().toISOString().split('T')[0];
    const request = { ticker: ticker.trim(), date: date.trim() };
    const result = await this.dataAnalystService.analyzeData(request);
    if (result.success) {
      return result.data as string;
    } else {
      return `Failed to perform data analysis: ${result.error}`;
    }
  }
}
