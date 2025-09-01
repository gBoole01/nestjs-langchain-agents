import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PortfolioService } from './portfolio.service';

/**
 * Zod schema for the input of the PortfolioTool.
 * We'll use a simple schema with no inputs since the tool just retrieves all data.
 */
const portfolioSchema = z.object({});

@Injectable()
export class PortfolioTool {
  constructor(private readonly portfolioService: PortfolioService) {}

  getTool() {
    return tool(
      async () => {
        try {
          console.log('PortfolioTool called to retrieve portfolio.');
          const portfolio = this.portfolioService.findAll();
          return JSON.stringify(portfolio, null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to retrieve portfolio data',
            message: error.message,
          });
        }
      },
      {
        name: 'get_portfolio',
        description: `
          A tool to retrieve all portfolio holdings and their current values.
          This tool provides a complete list of assets, shares, prices, and total value.
          
          Use this tool when the user asks for:
          - A list of their current holdings.
          - The total value of their portfolio.
          - Details about specific stocks in their portfolio.
          
          The tool returns a JSON object containing a list of all portfolio items.
        `.trim(),
        schema: portfolioSchema,
      },
    );
  }
}
