import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangchainCoreModule } from 'src/langchain-core.module';
import { ToolsModule } from '../../tools/tools.module';
import { ArchivistService } from './crew/archivist.service';
import { InternalCriticAgent } from './crew/internal-critic-agent.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';
import { ToolExecutorAgent } from './crew/tool-executor-agent.service';
import { SectorialAnalysisAgentService } from './sectorial-analysis-agent.service';

@Module({
  imports: [ConfigModule, LangchainCoreModule, ToolsModule],
  providers: [
    SectorialAnalysisAgentService,
    ResearchOrchestratorService,
    ToolExecutorAgent,
    InternalCriticAgent,
    ArchivistService,
  ],
  exports: [SectorialAnalysisAgentService],
})
export class SectorialAnalysisAgentModule {}
