# Elite Wagers v5.0

Sports research and analytics workspace. This is a research-only tool; it does not place wagers.

## What's included

- Existing Elite Wagers research pages, slate prompts, player props, odds tools, StatMuse shortcuts, weather, ESPN scoreboard/news, and browser research log.
- New Probability Model Lab with a team matchup scorecard and ten weighted edge categories: team strength, offense, defense, matchup, recent form, injuries/availability, rest/travel, venue, weather, and starting goalie/pitcher/key starter.
- Transparent win-probability calculation based on user-entered score projections, a user-selected margin standard deviation, and weighted edge adjustments.
- 10,000-trial probability simulation using the same stated normal-margin assumption.
- Player prop projection using last-15 average, opponent history, sample size, a conservative cap on opponent-history weight, and a normal-distribution assumption.
- Browser-local prediction history, result grading, accuracy, Brier score and CSV export.
- Node server gateway for ESPN public scoreboard/news, Open-Meteo weather, The Odds API and a configurable third-party projections endpoint.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:8787.

## Optional server environment variables

- `THE_ODDS_API_KEY`: API key for The Odds API. Set this on the server, never in browser JavaScript.
- `PRIZEPICKS_API_URL`: endpoint URL from a third-party projections provider that you are authorized to use.
- `PRIZEPICKS_API_KEY`: key supplied by that provider. The endpoint is configurable because there is no official public PrizePicks developer API assumed by this project. Confirm provider terms and response format before use.
- `PORT`: server port; hosting platforms generally set this automatically.

ESPN public JSON endpoints are unofficial and can change. Open-Meteo provides public weather/geocoding endpoints. The Odds API and CollegeFootballData require API keys and have plan limits. StatMuse is linked for research; do not scrape or use a commercial API without confirming its licensing. Check every provider's terms, rate limits, attribution and commercial-use permissions before public launch.

## Model notes and limitations

The Probability Model Lab is deliberately transparent and input-driven. It is not a trained model and has not been validated against historical results. The weights are starter defaults, not proven universal weights. The edge categories are scored from -5 to +5 and combined with fixed weights. The resulting weighted edge is converted to an adjustment to the expected score margin using the user-controlled points-per-edge setting. A normal CDF converts the adjusted margin and chosen standard deviation into a probability. The Monte Carlo check samples that same assumed distribution; it is not independent confirmation.

Do not enter missing injuries, lineups, goalie/pitcher confirmations or weather as if verified. Keep source, timestamp and sample size with every manual input. Backtesting is stored in the browser's localStorage on that device/browser, not on a central account. Grade predictions only after final results. Draws/ties are retained as a separate grade but excluded from the current binary accuracy and Brier score summary.

## Deploy on Render

1. Push the contents of this folder to a GitHub repository.
2. In Render, create a new Web Service from that repository.
3. Render should detect `render.yaml`; use `npm install` as build command and `npm start` as start command.
4. Add any API keys as Render environment variables. Never commit secrets to GitHub.
5. Deploy and open the generated public URL.

## Data sources to review

- StatMuse: https://www.statmuse.com/
- ESPN: https://www.espn.com/ (public endpoints are unofficial)
- Open-Meteo: https://open-meteo.com/
- The Odds API: https://the-odds-api.com/
- nflverse: https://nflverse.nflverse.com/
- CollegeFootballData: https://collegefootballdata.com/
- MLB Stats API: https://statsapi.mlb.com/
- Baseball Savant: https://baseballsavant.mlb.com/
- NHL API: https://api-web.nhle.com/
- Natural Stat Trick: https://www.naturalstattrick.com/
- FBref: https://fbref.com/
- Understat: https://understat.com/

This source list does not mean every source has been integrated as an automated feed. Only the providers described in the server section have live server routes in this package.
