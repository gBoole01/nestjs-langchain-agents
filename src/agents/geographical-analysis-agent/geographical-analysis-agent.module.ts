import { Module } from '@nestjs/common';
import { GeographicalAnalysisAgentService } from './geographical-analysis-agent.service';

@Module({
  imports: [],
  providers: [],
  exports: [GeographicalAnalysisAgentService],
})
export class GeographicalAnalysisAgentModule {}
