import { Global, Module } from '@nestjs/common';
import { AnalysisRunsService } from './analysis-runs.service';
import { RunsController } from './runs.controller';

@Global()
@Module({
  providers: [AnalysisRunsService],
  controllers: [RunsController],
  exports: [AnalysisRunsService],
})
export class RunsModule {}
