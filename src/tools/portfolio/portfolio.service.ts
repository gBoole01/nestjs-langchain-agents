import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PortfolioService {
  private portfolio: any[] = [];

  constructor() {
    const filePath = join(
      __dirname,
      '..',
      '..',
      '..',
      'data',
      'portfolio.json',
    );
    const fileData = readFileSync(filePath, 'utf-8');
    this.portfolio = JSON.parse(fileData);
  }

  findAll() {
    return this.portfolio;
  }
}
