# LLM Graph

A single-page chart of LLMs by [Artificial Analysis](https://artificialanalysis.ai/) Intelligence Index against cost per task. Each line is one model and each dot on it is a reasoning effort level. The 10 highest-scoring models show by default. Use the model menu to show or hide others.

## How data gets in

There is no backend. `scripts/fetch-data.ts` pulls every model from the Artificial Analysis free API, and the build bakes that data into the site. GitHub Actions rebuilds and redeploys every 4 hours, so new models show up without code changes.

Grouping is automatic. Effort variants like `GPT-6 Astra (xhigh)` merge into one line, and a model is drawn dashed when a newer version of the same product line exists. See `src/lib/families.ts`.

The free API allows 100 requests a day and a full fetch takes about 4 of them, so the schedule stays well under the limit.

## Local development

Requires Node 24 and pnpm.

```sh
echo "AA_KEY=your-artificial-analysis-key" > .env
pnpm install
pnpm dev
```

`pnpm dev` fetches data first and reuses it for 6 hours. Run `pnpm fetch-data --force` to refresh it sooner.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to the Cloudflare Pages project `llm-graph`. It runs on pushes to `main`, on pull requests (as preview deployments) and on the 4-hour schedule. The first run creates the Pages project.

Repository secrets:

| Secret | Value |
| --- | --- |
| `AA_KEY` | Artificial Analysis API key |
| `CLOUDFLARE_API_TOKEN` | Token with Account > Cloudflare Pages > Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
