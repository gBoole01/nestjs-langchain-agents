import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * This agent will run monthly for each monitored geographical area.
 * Then it will store the results in a database.
 * He will also expose its results to other agents.
 * TIMEFRAME: 6 months
 */
@Injectable()
export class GeographicalAnalysisAgentService implements OnModuleInit {
  private readonly logger = new Logger(GeographicalAnalysisAgentService.name);

  constructor() {}

  async onModuleInit() {
    this.logger.log('Geographical Analysis Agent initialized');
  }
}
