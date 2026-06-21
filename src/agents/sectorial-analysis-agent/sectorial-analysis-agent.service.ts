import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * This agent will run monthly for each monitored activity sector.
 * Then it will store the results in a database.
 * He will also expose its results to other agents.
 * TIMEFRAME: 12 months
 */
@Injectable()
export class SectorialAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(SectorialAnalysisAgentService.name);

  constructor() {}

  async onModuleInit() {
    this.logger.log('Sectorial Analysis Agent initialized');
  }
}
