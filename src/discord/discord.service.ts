import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { splitMessage } from './utils/splitMessage';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly webhookUrl: string;
  private readonly maxLength = 2000;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
  }

  async sendToDiscord(message: string): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.error(
        'DISCORD_WEBHOOK_URL not found in environment variables.',
      );
      return;
    }

    const chunks = splitMessage(message, this.maxLength);

    for (const chunk of chunks) {
      const payload = {
        content: chunk,
      };

      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          this.logger.error(
            `❌ Failed to send a chunk of the report to Discord: ${response.status} ${response.statusText}`,
          );
          const errorText = await response.text();
          this.logger.error('Discord API response:', errorText);
        }
      } catch (error) {
        this.logger.error(
          'An error occurred while sending a chunk to Discord:',
          error,
        );
      }
    }

    if (chunks.length > 0) {
      this.logger.log(
        `✅ Report successfully sent to Discord in ${chunks.length} message(s).`,
      );
    }
  }
}
