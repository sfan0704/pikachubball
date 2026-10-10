// Runs the Yahoo stand-in for local development: `npm run standin`.
import { createYahooStandIn } from "../server/dev/yahoo-standin";

const port = Number(process.env.STANDIN_PORT ?? 5090);
createYahooStandIn({ fixturesDir: "tests/backend/fixtures/yahoo" }).listen(
  port,
  "127.0.0.1",
  () => {
    console.log(`Yahoo stand-in on http://127.0.0.1:${port}`);
  }
);
