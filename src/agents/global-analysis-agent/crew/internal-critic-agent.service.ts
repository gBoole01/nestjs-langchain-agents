import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { geminiOnFailedAttempt } from 'src/common/llm/gemini-rate-limit-retry.util';
import { z } from 'zod';

// Define the structured output for the critic's verdict
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const criticVerdictSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  feedback: z.string(),
});

type CriticVerdict = z.infer<typeof criticVerdictSchema>;

@Injectable()
export class InternalCriticAgent {
  private readonly logger = new Logger(InternalCriticAgent.name);
  private readonly model: ChatGoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const googleApiKey = this.configService.get('GEMINI_API_KEY');
    this.model = new ChatGoogleGenerativeAI({
      apiKey: googleApiKey,
      model: this.configService.get<string>('GEMINI_MODEL'),
      temperature: 0.1,
      maxRetries: 8,
      onFailedAttempt: geminiOnFailedAttempt,
    });
  }

  public async evaluateData(rawData: string): Promise<CriticVerdict> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a highly discerning data critic. Your sole purpose is to evaluate the quality and relevance of raw text data.
        
        **Evaluation Criteria:**
        1.  **Relevance:** Is the content relevant to a global economic query?
        2.  **Completeness:** Does the content appear complete and not truncated?
        3.  **Credibility:** Does the content cite credible sources?
        
        Provide a verdict of 'PASS' if the data is high-quality and relevant, and 'FAIL' if it is not.
        Your output MUST be a valid JSON object with the following schema:
        {{ "verdict": "PASS" | "FAIL", "feedback": "brief explanation" }}`,
      ],
      ['human', 'Please evaluate the following raw data:\n\n{raw_data}'],
    ]);

    const parser = new JsonOutputParser<CriticVerdict>();
    const chain = prompt.pipe(this.model).pipe(parser);

    try {
      const result = await chain.invoke({ raw_data: rawData });
      return result;
    } catch (error) {
      this.logger.error(
        'Internal Critic failed to evaluate data:',
        error.message,
      );
      return {
        verdict: 'FAIL',
        feedback: 'An error occurred during evaluation.',
      };
    }
  }
}
