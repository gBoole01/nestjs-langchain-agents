import { Module } from '@nestjs/common';
import { SectorialAnalysisAgentService } from './sectorial-analysis-agent.service';

@Module({
  imports: [],
  providers: [],
  exports: [SectorialAnalysisAgentService],
})
export class SectorialAnalysisAgentModule {}
