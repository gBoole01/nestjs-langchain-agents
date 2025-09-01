import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { ExpressAdapter } from '@nestjs/platform-express';
// import express from 'express';
// import { AppModule } from './app.module';

// let cachedServer: any;

// async function bootstrap() {
//   const expressApp = express();
//   const server = await NestFactory.create(
//     AppModule,
//     new ExpressAdapter(expressApp),
//   );
//   await server.init();
//   return expressApp;
// }

// export default async (req, res) => {
//   if (!cachedServer) {
//     cachedServer = await bootstrap();
//   }
//   cachedServer(req, res);
// };
