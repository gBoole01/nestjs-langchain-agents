import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { WebScrapingService } from './web-scraping.service';

/**
 * Zod schema for the input of the WebScrapingTool.
 */
const webScrapingSchema = z.object({
  url: z.string().describe('The URL of the webpage to scrape and summarize.'),
});

/**
 * Service that creates a webpage content scraping and summarizing tool.
 * This tool uses the WebScrapingService to fetch and summarize content.
 */
@Injectable()
export class WebScrapingTool {
  constructor(private readonly webScrapingService: WebScrapingService) {}

  getTool() {
    return tool(
      async (input) => {
        try {
          console.log('WebScrapingTool called with input:', input);
          const { url } = input;
          const enrichedResults =
            await this.webScrapingService.enrichWebSearchResults([
              { title: '', link: url, snippet: '' },
            ]);

          if (enrichedResults.length === 0) {
            return JSON.stringify({
              error: 'Failed to scrape or summarize content from the URL.',
              url,
            });
          }

          return JSON.stringify(enrichedResults[0], null, 2);
        } catch (error) {
          return JSON.stringify({
            error: 'Failed to scrape webpage content',
            message: error.message,
            url: input.url,
          });
        }
      },
      {
        name: 'web_scrape_and_summarize',
        description: `
          A tool that scrapes the content of a given URL and provides a synthesized summary.
          This is useful when a search returns a promising link, and you need to "read" the webpage
          to get a more detailed answer.
          
          Use this tool on a URL provided by a search tool to get a summary of its content.
          
          The tool returns a JSON object with a summary and key facts from the webpage.
        `.trim(),
        schema: webScrapingSchema,
      },
    );
  }
}
