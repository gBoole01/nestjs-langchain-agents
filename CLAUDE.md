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

Each analysis domain is its own Nest module under `src/agents/<domain>-analysis-agent/`. Two are fully implemented, two are stubs:

- **`stock-analysis-agent/`** — the most developed agent, with **two parallel execution paths** for the same workflow:
  - `StockAnalysisAgentService` — procedural "crew" orchestration: Archivist (past report) → DataAnalyst + Journalist in parallel → Writer/Critic loop (max 5 iterations until PASS) → Archivist saves final report → Discord.
  - `StockAnalysisAgentGraphService` — the same workflow expressed as a LangGraph `StateGraph` (`Annotation.Root` state with `ticker`, `date`, `portfolio_analysis`, `archivist_report`, `data_report`, `news_report`, `writer_draft`, `critic_verdict`, `critic_feedback`). Treat these two as alternate implementations of one workflow, not unrelated features — changes to the report flow likely need to land in both, or you should ask which one is the source of truth before editing.
  - Supporting "crew" agents: `DataAnalystAgentService` (Tiingo data), `JournalistAgentService` (Serper news/web + scraping), `WriterAgentService`, `CriticAgentService`, `PortfolioAnalystAgentService` (current portfolio holdings), `ArchivistAgentService` (RAG save/retrieve), `AgentDebugService`.
  - Each crew agent follows the same internal pattern: instantiate `ChatGoogleGenerativeAI`, build an `AgentExecutor` via `createToolCallingAgent` with a `StructuredToolInterface[]` and a `MessagesPlaceholder` scratchpad, and return a uniform `AgentResult` (`{ success, data, error?, metadata? }`).
- **`global-analysis-agent/`** — macroeconomic analysis, also LangGraph-based (`fetch_new_data` → `process_data` → `synthesize_report` → `archive_final_report`), with its own `ResearchOrchestratorService`, `ToolExecutorAgent`, `InternalCriticAgent`, `ArchivistService`.
- **`geographical-analysis-agent/`** and **`sectorial-analysis-agent/`** — module/service files exist but are empty stubs (no providers wired in their modules). Current branch work ("broader analyst") is extending this family — check whether a stub is the right starting point before writing a new agent from scratch.

If you add a new "analysis agent," mirror the existing module shape (`<name>.module.ts` + `<name>.service.ts`, importing the tool modules it needs) rather than inventing a new structure.

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

- `Report` is the one Mongoose schema in the app (`ticker`, `reportContent`, `date`, `vector`), used both as the durable report archive and as the source for vector retrieval in production.
- `data/portfolio.json` / `data/input.json` are static, hand-edited holdings files read directly by `PortfolioService` — there's no portfolio API or DB table, so "update the portfolio" means editing this JSON.

### Deployment

`vercel.json` + `api/index.js` exist for a serverless deployment (Express adapter wrapping the Nest app), but the handler in `api/index.js` is currently inactive/commented out — `main.ts` runs as a standalone listener on port 3000. Don't assume the Vercel path is live without checking `api/index.js` first.

### TypeScript

`tsconfig.json` has `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` all disabled — this codebase is intentionally **not** in TS strict mode, unlike the conventions in global instructions. Match the existing looser style within this repo rather than introducing strict-mode-only patterns that the rest of the file doesn't use.
