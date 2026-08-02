import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BroaderAnalysisModule } from 'src/agents/broader-analysis/broader-analysis.module';
import { LangchainCoreModule } from 'src/langchain-core.module';
import { ToolsModule } from '../../tools/tools.module';
import { ArchivistService } from './crew/archivist.service';
import { InternalCriticAgent } from './crew/internal-critic-agent.service';
import { ResearchOrchestratorService } from './crew/research-orchestrator.service';
import { ToolExecutorAgent } from './crew/tool-executor-agent.service';
import { SectorialAnalysisAgentController } from './sectorial-analysis-agent.controller';
import { SectorialAnalysisAgentService } from './sectorial-analysis-agent.service';

@Module({
  imports: [
    ConfigModule,
    LangchainCoreModule,
    ToolsModule,
    BroaderAnalysisModule,
  ],
  controllers: [SectorialAnalysisAgentController],
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
