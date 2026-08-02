import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { AnalysisRunsService } from './analysis-runs.service';
import { RunRecord } from './run.types';

@Controller('runs')
export class RunsController {
  constructor(private readonly analysisRunsService: AnalysisRunsService) {}

  @Get()
  list(@Query('type') type?: string): RunRecord[] {
    return this.analysisRunsService.list(type);
  }

  @Get(':id')
  getById(@Param('id') id: string): RunRecord {
    const run = this.analysisRunsService.get(id);
    if (!run) {
      throw new NotFoundException(`Run ${id} not found`);
    }
    return run;
  }
}
