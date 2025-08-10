import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SerperWebService } from './serper-web.service';

/**
 * Zod schema for the input of the SerperWebTool.
 */
const serperWebSchema = z.object({
  query: z.string().describe('The search query for Web.'),
});

/**
 * Service that creates a web fetching tool using the modern tool() function.
 * This tool uses the SerperService to get recent Web articles.
 */
@Injectable()
export class SerperWebTool {
  constructor(private readonly serperService: SerperWebService) {}

  getTool() {
    return tool(
      async (input) => {
        try {
          console.log('SerperWebTool called with input:', input);
          const { query } = input;
          const WebResults = await this.serperService.webSearchTool({
            query,
          });
          return JSON.stringify(WebResults, null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to fetch Web data',
            message: error.message,
            query: input.query,
          });
        }
      },
      {
        name: 'serper_web_search',
        description: `
          A tool to search the 10 top Web pages related to a specific query.
          The tool is useful for getting broad information on any topic.
          
          Use this tool when users ask for:
          - Web search results for a specific topic
          - General Web related to a topic
          - Web pages related to a specific company or stock
          
          The tool returns a JSON object containing a list of Web results.
        `.trim(),
        schema: serperWebSchema,
      },
    );
  }
}
