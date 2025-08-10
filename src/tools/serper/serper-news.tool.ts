import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SerperNewsService } from './serper-news.service';

/**
 * Zod schema for the input of the SerperNewsTool.
 */
const serperNewsSchema = z.object({
  query: z.string().describe('The search query for news.'),
});

/**
 * Service that creates a news fetching tool using the modern tool() function.
 * This tool uses the SerperService to get recent news articles.
 */
@Injectable()
export class SerperNewsTool {
  constructor(private readonly serperService: SerperNewsService) {}

  getTool() {
    return tool(
      async (input) => {
        try {
          console.log('SerperNewsTool called with input:', input);
          const { query } = input;
          const newsResults = await this.serperService.newsSearchTool({
            query,
          });
          return JSON.stringify(newsResults, null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to fetch news data',
            message: error.message,
            query: input.query,
          });
        }
      },
      {
        name: 'serper_news_search',
        description: `
          A tool to search for recent news articles related to a specific query.
          The tool is useful for getting the latest information on companies, stocks, or general market events.
          
          Use this tool when users ask for:
          - News about a company or stock
          - Recent market headlines
          - General news related to a topic
          
          The tool returns a JSON object containing a list of news results.
        `.trim(),
        schema: serperNewsSchema,
      },
    );
  }
}
