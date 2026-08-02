# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **npm** (package-lock.json is checked in — do not switch to pnpm/yarn here).

```bash
npm run start:dev       # NestJS in watch mode (port 3000)
npm run start:debug     # watch mode + --inspect
npm run build           # nest build -> dist/
npm run start:prod      # node dist/main

npm run lint            # eslint --fix over src,apps,libs,test

npm test                # jest unit tests
npm run test:watch
npm run test:cov
npm run test:e2e        # jest --config ./test/jest-e2e.json

# single test file
npx jest path/to/file.spec.ts
# single test by name
npx jest -t "test name"
```

Local infra (MongoDB + ChromaDB) for development:
```bash
docker-compose up -d
```

## Environment

Copy `.env.example` to `.env`. Required vars by area:
- Mongo: `MONGO_HOST`, `MONGO_PORT`, `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE`, `MONGO_USERNAME`, `MONGO_PASSWORD`
- AI: `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLAMA_HOST`
- Data/search tools: `TIINGO_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY`
- Discord output: `DISCORD_WEBHOOK_URL`
- `NODE_ENV` controls vector store backend (see below) — `VERBOSE` for extra logging

There is no `validation.schema.ts` — config is read directly via `ConfigService`, no startup validation.

## Architecture

This is a NestJS app whose domain logic is a set of **LangChain/LangGraph agents** that analyze financial markets and a personal portfolio, producing reports that get archived (Mongo + vector store) and pushed to Discord.

### Core wiring

- `src/app.module.ts` — root module. Sets up `MongooseModule` (builds the Mongo URI from `MONGO_*` env vars, supports both `mongodb://` and `mongodb+srv://`), registers the `Report` schema, and imports the tool/agent/integration modules.
- `src/langchain-core.module.ts` — `LangchainCoreModule` provides the shared embeddings/vector-store providers used for RAG:
  - `Embeddings` → `GoogleGenerativeAIEmbeddings`
  - `VectorStore` → **Chroma** (`http://localhost:8000`) when `NODE_ENV` is dev, **`MongoDBAtlasVectorSearch`** in production
  - This dev/prod vector-store split is the one piece of conditional infra logic that recurs throughout the RAG/archivist code — keep it in mind when touching anything that persists or retrieves reports.

### Agents (`src/agents/`)

Each analysis domain is its own Nest module under `src/agents/<domain>-analysis-agent/`, each with a controller exposing it to the frontend:

- **`stock-analysis-agent/`** — the most developed agent, with **two parallel execution paths** for the same workflow:
  - `StockAnalysisAgentService` — procedural "crew" orchestration: Archivist (past report) → DataAnalyst + Journalist in parallel → Writer/Critic loop (max 5 iterations until PASS) → Archivist saves final report → Discord.
  - `StockAnalysisAgentGraphService` — the same workflow expressed as a LangGraph `StateGraph` (`Annotation.Root` state with `ticker`, `date`, `portfolio_analysis`, `archivist_report`, `data_report`, `news_report`, `writer_draft`, `critic_verdict`, `critic_feedback`). Treat these two as alternate implementations of one workflow, not unrelated features — changes to the report flow likely need to land in both, or you should ask which one is the source of truth before editing.
  - Supporting "crew" agents: `DataAnalystAgentService` (Tiingo data), `JournalistAgentService` (Serper news/web + scraping), `WriterAgentService`, `CriticAgentService`, `PortfolioAnalystAgentService` (current portfolio holdings), `ArchivistAgentService` (RAG save/retrieve), `AgentDebugService`.
  - Each crew agent follows the same internal pattern: instantiate `ChatGoogleGenerativeAI`, build an `AgentExecutor` via `createToolCallingAgent` with a `StructuredToolInterface[]` and a `MessagesPlaceholder` scratchpad, and return a uniform `AgentResult` (`{ success, data, error?, metadata? }`).
- **`global-analysis-agent/`**, **`geographical-analysis-agent/`**, **`sectorial-analysis-agent/`** — the "broader analysis" family, all fully implemented and structurally identical LangGraph agents (`fetch_new_data` → `process_data` → `synthesize_report` → `archive_final_report`), differing only in subject (whole-market / region / sector) and cadence. Each has its own `ResearchOrchestratorService`, `ToolExecutorAgent`, `InternalCriticAgent`, `ArchivistService`, and imports the shared `BroaderAnalysisModule`. Treat these three as one family — a change to the workflow shape in one (e.g. the `synthesize_report` node or archiving logic) almost certainly belongs in all three.
  - `synthesize_report` calls `this.model.withStructuredOutput(broaderReportSchema)` (from `broader-analysis/broader-report.types.ts`) instead of a free-text completion, so `finalReport` is a typed `{ sections: { heading, content }[] }`, not a string.
  - Each agent's `ArchivistService.storeFinalReport` writes one vector-store `Document` **per section** (`pageContent: section.content`, `metadata: { ..., heading }`) rather than one document for the whole report — this is what improves chunking for retrieval.
  - The public `run()` method on each service still returns a markdown string for Discord/API consumers, produced by `renderBroaderReportMarkdown()` (`broader-analysis/broader-report.util.ts`), which joins the sections back into `# subject — period` / `## heading` markdown.
  - Cadence/period handling (`YYYY-S1/S2`, `YYYY-Q1..4`, `YYYY-M01..12`, `YYYY-W01..53`) is centralized in `broader-analysis/period.util.ts` (`parsePeriod`, `getPeriodBounds`, `getPeriodLabel`, `enumeratePeriods`, `addPeriods`) — used for both freshness checks (don't regenerate a report already covering the current period) and backfill (generate missing historical periods).

If you add a new "analysis agent," mirror the existing module shape (`<name>.module.ts` + `<name>.service.ts` + `<name>.controller.ts`, importing the tool modules it needs) rather than inventing a new structure. For a "broader analysis"-style agent specifically, mirror `global-analysis-agent/` and wire in `BroaderAnalysisModule` rather than starting from scratch.

### Broader analysis shared module (`src/agents/broader-analysis/`)

Shared persistence/formatting layer used by the global/geographical/sectorial agents (not by `stock-analysis-agent`, which has its own `Report` schema/Archivist):

- `broader-report.types.ts` — `broaderReportSchema` (zod) / `BroaderReportSections` type: the structured `{ sections: [{ heading, content }] }` shape the LLM is forced into via `withStructuredOutput`.
- `broader-report.util.ts` — `renderBroaderReportMarkdown(subject, periodLabel, report)`: sections → single markdown string, for callers that just want text (Discord, API responses).
- `models/broader-report.model.ts` — `BroaderReport` Mongoose schema (`domain: 'global'|'geographical'|'sectorial'`, `subject`, `sections: BroaderReportSection[]`, `period`, `date`), indexed on `{ domain, subject, period }`. Distinct from the stock agent's `Report` schema — don't conflate the two when touching persistence.
- `broader-reports.service.ts` — `BroaderReportsService`: `save`, `list`, `getById`, plus two freshness checks agents call before running: `hasReportWithinWindow` (has anything been generated since a cutoff, for normal scheduled runs) and `hasReportForPeriod` (does this exact domain/subject/period already exist, used by backfill to skip periods already generated).
- `period.util.ts` — cadence math shared by all three agents (see above).

### Runs tracking (`src/runs/`)

`RunsModule` is `@Global()` and exports `AnalysisRunsService`, an in-memory (not persisted — lost on restart) registry of in-flight/completed agent runs (`RunRecord: { id, type, input, status, result?, error?, createdAt, updatedAt }`). Agents call `start(type, input, task)` to kick off a run and get an id back immediately; `RunsController` (`GET /runs`, `GET /runs/:id`) exposes status polling for the frontend. Also used to guard against duplicate concurrent runs via `hasPendingRun`/`hasPendingRunToday`.

### Tools (`src/tools/`)

Each tool is a small Nest module pairing a `*.service.ts` (the actual API/library client) with a `*.tool.ts` (a `@langchain/core/tools` wrapper exposing it to agents). `tools.module.ts` aggregates them.

- `tiingo/` — `TiingoService` calls `https://api.tiingo.com/tiingo/daily` for OHLCV data; `FetchStockDataTool` exposes it. Used by `DataAnalystAgentService`.
- `serper/` — `SerperNewsService`/`SerperWebService` (+ `SerperReviewsService`, not tool-wrapped) hit the Serper search API; `SerperNewsTool`/`SerperWebTool` expose news/web search. Used by `JournalistAgentService`.
- `web-scraping/` — `WebScrapingService` uses Puppeteer + Cheerio to fetch and LLM-summarize a URL; `WebScrapingTool` takes `{ url }`. Used by `JournalistAgentService`.
- `portfolio/` — `PortfolioService` reads holdings straight from `data/portfolio.json` (no DB); `PortfolioTool` returns it as JSON. Used by `PortfolioAnalystAgentService`.
- `rag/` — `ReportRetrievalService` does similarity search over past `Report` documents — Chroma in dev, Mongo `$vectorSearch` in prod (same split as `LangchainCoreModule`); `ReportRetrievalTool` takes `{ query }`. Used by `ArchivistAgentService` and `GlobalAnalysisAgentService`.

### Integrations

- `src/integrations/discord/` — `@Global()` `DiscordModule` exporting `DiscordService.sendToDiscord(message)`, which posts a webhook message (chunked to Discord's 2000-char limit). Agents call this at the end of a run to deliver the final report.

### Data persistence

- `Report` (`src/agents/stock-analysis-agent/models/reports.model.ts`, registered in `app.module.ts`) is the stock-analysis schema (`ticker`, `reportContent`, `date`, `vector`) — durable archive + source for vector retrieval in production.
- `BroaderReport` (`src/agents/broader-analysis/models/broader-report.model.ts`) is the separate schema for global/geographical/sectorial reports — `domain`, `subject`, `sections` (structured, not a flat string), `period`, `date`. Don't assume the two schemas are interchangeable or share a service.
- `data/portfolio.json` / `data/input.json` are static, hand-edited holdings files read directly by `PortfolioService` — there's no portfolio API or DB table, so "update the portfolio" means editing this JSON.

### Deployment

`vercel.json` + `api/index.js` exist for a serverless deployment (Express adapter wrapping the Nest app), but the handler in `api/index.js` is currently inactive/commented out — `main.ts` runs as a standalone listener on port 3000. Don't assume the Vercel path is live without checking `api/index.js` first.

### TypeScript

`tsconfig.json` has `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` all disabled — this codebase is intentionally **not** in TS strict mode, unlike the conventions in global instructions. Match the existing looser style within this repo rather than introducing strict-mode-only patterns that the rest of the file doesn't use.
