# LLM Graph

**Live at [models.chriscorbell.com](https://models.chriscorbell.com)**

A single-page chart of LLMs by [Artificial Analysis](https://artificialanalysis.ai/) Intelligence Index against cost per task. Each line is one model and each dot on it is a reasoning effort level. The 10 highest-scoring models show by default. Use the model menu to show or hide others.

## How data gets in

There is no backend. `pnpm build` runs `scripts/fetch-data.ts`, which pulls every model from the Artificial Analysis free API, and the build bakes that data into the site. A scheduled GitHub Action triggers a fresh Cloudflare Pages build every 4 hours, so new models show up without code changes.

Grouping is automatic. Effort variants like `GPT-6 Astra (xhigh)` merge into one line, and a model is drawn dashed when a newer version of the same product line exists. See `src/lib/families.ts`.

The free API allows 100 requests a day and a full fetch takes about 4 of them, so the schedule stays well under the limit.

## Local development

Requires Node 24 and pnpm.

```sh
echo "AA_KEY=your-artificial-analysis-key" > .env
pnpm install
pnpm dev
```

`pnpm dev` and `pnpm build` fetch data first and reuse it for 6 hours locally. Run `pnpm fetch-data --force` to refresh it sooner.

## Deployment

Cloudflare Pages builds the site from this repo through its GitHub integration: pushes to `main` go to production at models.chriscorbell.com (also llm-graph.pages.dev) and other branches get preview URLs.

Pages build settings:

| Setting | Value |
| --- | --- |
| Build command | `pnpm build` |
| Output directory | `dist` |
| `PNPM_VERSION` | `11.25.0` |
| `AA_KEY` (encrypted) | Artificial Analysis API key |

`.github/workflows/refresh.yml` posts to a Pages deploy hook every 4 hours to pick up new data. It needs the hook URL in the `CF_DEPLOY_HOOK` repository secret. `.github/workflows/ci.yml` runs the tests on pushes and pull requests.
