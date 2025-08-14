import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const expressApp = express();
const server = await NestFactory.create(
  AppModule,
  new ExpressAdapter(expressApp),
);

export default server;
