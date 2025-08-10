import { WebSearchResult } from '../serper.types';

/**
 * Formats the search results for the LLM.
 * @param data The search results to format.
 * @returns A string of formatted search results.
 */
export async function formatWebSearchResults(
  data: WebSearchResult[],
): Promise<string> {
  const formattedResults = data
    .map((result: WebSearchResult, index: number) => {
      return `
            Result ${index + 1}:
            Title: ${result.title}
            Link: ${result.link}
            Snippet: ${result.snippet}
            `;
    })
    .join('\n');

  return `
    Top Search Results:
    ${formattedResults}
    `;
}
