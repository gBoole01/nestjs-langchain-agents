import { Logger } from '@nestjs/common';
import { classifyRateLimitError } from '@langchain/core/utils/async_caller';

const logger = new Logger('GeminiRateLimitRetry');

// Statuses LangChain's default handler treats as non-retryable (client errors).
const STATUS_NO_RETRY = [400, 401, 402, 403, 404, 405, 406, 407, 409];

// Matches the `RetryInfo` hint Gemini embeds in 429 payloads, e.g. `"retryDelay":"41s"`.
const RETRY_DELAY_PATTERN = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i;

function getStatus(error: any): number | undefined {
  return error?.status ?? error?.response?.status;
}

function parseGeminiRetryDelayMs(message?: string): number | undefined {
  const match = message ? RETRY_DELAY_PATTERN.exec(message) : null;
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

/**
 * Gemini's free-tier RPM 429s are worded as "You exceeded your current quota",
 * which LangChain's default retry handler classifies as permanently exhausted
 * billing quota and aborts all retries immediately. These errors also carry a
 * `retryDelay` RetryInfo hint (the actual RPM reset window, usually <60s) — when
 * present, treat it as transient and retry after waiting that long instead.
 */
export function geminiOnFailedAttempt(error: any): void {
  if (
    error?.name === 'AbortError' ||
    (typeof error?.message === 'string' && error.message.startsWith('Cancel'))
  ) {
    throw error;
  }

  const status = getStatus(error);
  if (status && STATUS_NO_RETRY.includes(+status)) {
    throw error;
  }

  const geminiRetryDelayMs = parseGeminiRetryDelayMs(error?.message);
  if (geminiRetryDelayMs !== undefined) {
    logger.warn(
      `Gemini rate limit hit, waiting ${Math.round(geminiRetryDelayMs / 1000)}s for RPM reset before retrying`,
    );
    error.retryAfterMs = geminiRetryDelayMs + 500;
    return;
  }

  const classification = classifyRateLimitError(error);
  if (!classification) {
    return;
  }

  if (classification.action === 'wait') {
    error.retryAfterMs = classification.retryAfterMs;
    return;
  }

  throw error;
}
