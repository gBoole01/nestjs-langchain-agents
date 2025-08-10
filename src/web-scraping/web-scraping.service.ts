import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import puppeteer, { Browser } from 'puppeteer';
import { WebSearchResult } from '../serper/serper.types';

export type EnrichedSearchResult = {
  title: string;
  link: string;
  summary: string;
};

@Injectable()
export class WebScrapingService {
  private readonly logger = new Logger(WebScrapingService.name);
  private readonly model: ChatGoogleGenerativeAI;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get('GOOGLE_API_KEY');
    this.model = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-1.5-flash',
      temperature: 0.1,
    });
  }

  /**
   * Scrapes the content of a single webpage using Puppeteer,
   * performing aggressive cleaning to remove irrelevant elements.
   * @param {string} url The URL of the page to scrape.
   * @returns {Promise<string>} The clean, main text content of the page.
   */
  private async scrapeWithPuppeteer(url: string): Promise<string> {
    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );

      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const html = await page.content();
      await browser.close();

      const $ = cheerio.load(html);

      const irrelevantSelectors = [
        'header',
        'footer',
        'nav',
        'aside',
        'script',
        'style',
        'noscript',
        '.sidebar',
        '#comments',
        'form',
        'iframe',
        '.ad',
        '.ads',
      ];

      irrelevantSelectors.forEach((selector) => $(selector).remove());

      const mainContent = $('body').text();

      return mainContent.replace(/\s+/g, ' ').trim();
    } catch (error) {
      this.logger.error(`Error scraping ${url}:`, error);
      if (browser) {
        await browser.close();
      }
      return `Error: Could not scrape content from ${url}.`;
    }
  }

  /**
   * Synthesizes web search results using an LLM.
   * @param searchResults An array of structured web search results.
   * @returns An array of enriched search results, each with a summary.
   */
  async enrichWebSearchResults(
    searchResults: WebSearchResult[],
  ): Promise<EnrichedSearchResult[]> {
    const enrichedResults: EnrichedSearchResult[] = [];

    for (const result of searchResults) {
      const scrapedContent = await this.scrapeWithPuppeteer(result.link);

      if (scrapedContent.startsWith('Error:') || scrapedContent.length === 0) {
        continue;
      }

      const messages = [
        new SystemMessage(
          `You are a brilliant researcher. Synthesize the following content into a concise summary of the key takeaways and main points.`,
        ),
        new HumanMessage(scrapedContent),
      ];

      try {
        const response = await this.model.invoke(messages);
        enrichedResults.push({
          title: result.title,
          link: result.link,
          summary: response.content.toString(),
        });
      } catch (error) {
        this.logger.error(
          `Failed to synthesize content for ${result.link}:`,
          error.message,
        );
      }
    }

    return enrichedResults;
  }
}
