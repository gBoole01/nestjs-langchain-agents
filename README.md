# NestJS LangChain Agents

This is a sample project that demonstrates how to use LangChain tools and agents in a NestJS application.

## Getting Started

To get started, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/gBoole01/nestjs-langchain-agents.git
```

1. Install dependencies:

```bash
npm install
```

1. Configure the project:

- Rename the `.env.example` file to `.env` and update the configuration values as needed.

1. Run the application:

```bash
npm run start:dev
```

## TODO List

- [x] Refine prompts
- [x] Add basic memory
- [x] Add orchestrator agent
- [x] Add data analyst agent to stock analysis
- [x] Add journalist agent to stock analysis
- [x] Add writer agent to stock analysis
- [x] Add critic agent to stock analysis
- [x] Add agent debug service
- [x] Add enhanced memory
- [x] Add archivist agent to stock analysis
- [x] Run stock analysis once per day per portfolio/watchlist item
- [x] For other analysis (e.g., global, regional, sector), limit them to one per semester for global, one per quarter for regional, and one per group-specific cadence (monthly/quarterly/weekly) for sectorial
- [X] Backfill other analysis past reports
- [x] Scrape and store tiingo data every day and have agents use it instead of calling the API
- [x] Add charts on frontend (sector repartition, item history)
- [x] Add portfolio analysis on portfolio page
- [x] Add related latest reports on portfolio detail page
- [x] Add administration page to manage the catalog
- [x] Add order management to provide a better tracking of portfolio evolutions
- [x] Adjusts the backfill/reports period to be more specific
- [x] On stock analysis, return a structured response to enhance the vector chunking and allow split displays on the frontend with the following fields:
  - Report
  - Overall Sentiment (Positive, Negative, Neutral)
  - Raising Trend (Up, Down, No Change)
- [x] On broader analysis, return a structured response to enhance the vector chunking and allow split displays on the frontend
- [ ] Create a new agent to analyze the portfolio and return a structured response to enhance the vector chunking and allow split displays on the frontend
- [ ] Self-Correction with LLM Tools
- [ ] Add planner agent to stock analysis
- [ ] Expand data sources
- [ ] Place orders on simulated trading platform

## Goal Project Structure

```text
src/
├── app.controller.spec.ts
├── app.controller.ts
├── app.module.ts
├── app.service.ts
├── main.ts
├── common/                          # Shared utilities and interfaces
│   ├── interfaces/
│   │   ├── tool.interface.ts        # Common tool interfaces
│   │   └── agent.interface.ts       # Common agent interfaces
│   ├── decorators/
│   │   └── tool.decorator.ts        # Custom decorators for tools
│   └── utils/
│       └── validation.utils.ts      # Common validation utilities
├── tools/                           # All LangChain tools
│   ├── tools.module.ts              # Global tools module
│   ├── financial/                   # Financial data tools
│   │   ├── financial-tools.module.ts
│   │   ├── tiingo/
│   │   │   ├── tiingo.service.ts
│   │   │   ├── tiingo.tool.ts       # Tool implementation
│   │   │   └── tiingo.module.ts
│   │   └── other-financial-apis/    # Future financial tools
│   ├── search/                      # Search-related tools
│   │   ├── search-tools.module.ts
│   │   ├── serper/
│   │   │   ├── serper.service.ts
│   │   │   ├── serper.tool.ts
│   │   │   └── serper.module.ts
│   │   └── tavily/
│   │       ├── tavily.tool.ts
│   │       └── tavily.module.ts
│   └── scraping/                    # Web scraping tools
│       ├── scraping-tools.module.ts
│       ├── web-scraping/
│       │   ├── web-scraping.service.ts
│       │   ├── web-scraping.tool.ts
│       │   └── web-scraping.module.ts
│       └── document-parser/         # Future scraping tools
├── agents/                          # All AI agents
│   ├── agents.module.ts             # Global agents module
│   ├── stock-analysis/
│   │   ├── stock-analysis-agent.service.ts
│   │   ├── stock-analysis-agent.module.ts
│   │   └── dto/
│   │       └── stock-query.dto.ts
│   ├── research/                    # Future research agent
│   │   ├── research-agent.service.ts
│   │   └── research-agent.module.ts
│   └── general/                     # General purpose agent
│       ├── general-agent.service.ts
│       └── general-agent.module.ts
├── integrations/                    # External service integrations
│   ├── discord/
│   │   ├── discord.service.ts
│   │   └── discord.module.ts
│   ├── slack/                       # Future integration
│   └── telegram/                    # Future integration
└── config/                          # Configuration management
    ├── configuration.ts
    └── validation.schema.ts
```
