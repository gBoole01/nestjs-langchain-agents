import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrapProd() {
  const expressApp = express();
  const server = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  await server.init();
  return expressApp;
}

async function bootstrapDev() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT || 3000);
}

if (process.env.NODE_ENV === 'production') {
  let cachedServer: any;
  const serverlessHandler = async (req, res) => {
    if (!cachedServer) {
      cachedServer = await bootstrapProd();
    }
    cachedServer(req, res);
  };
  module.exports = serverlessHandler;
} else {
  bootstrapDev();
}
