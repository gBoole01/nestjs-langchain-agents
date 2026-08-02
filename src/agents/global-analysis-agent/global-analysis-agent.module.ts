import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BroaderAnalysisModule } from 'src/agents/broader-analysis/broader-analysis.module';
import { LangchainCoreModule } from 'src/langchain-core.module';
import { ToolsModule } from '../../tools/tools.module';
import { ArchivistService } from './crew/archivist.service';
import { InternalCriticAgent } from './crew/internal-critic-agent.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';
import { ToolExecutorAgent } from './crew/tool-executor-agent.service';
import { GlobalAnalysisAgentController } from './global-analysis-agent.controller';
import { GlobalAnalysisAgentService } from './global-analysis-agent.service';

@Module({
  imports: [ConfigModule, LangchainCoreModule, ToolsModule, BroaderAnalysisModule],
  controllers: [GlobalAnalysisAgentController],
  providers: [
    GlobalAnalysisAgentService,
    ResearchOrchestratorService,
    ToolExecutorAgent,
    InternalCriticAgent,
    ArchivistService, // Ensure ArchivistService is listed as a provider
  ],
  exports: [GlobalAnalysisAgentService],
})
export class GlobalAnalysisAgentModule {}
