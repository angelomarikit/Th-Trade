import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const key = (process.env.ALPACA_API_KEY_ID || "").trim();
const secret = (process.env.ALPACA_API_SECRET_KEY || "").trim();

console.log(
  JSON.stringify(
    {
      keyLen: key.length,
      secretLen: secret.length,
      keyPrefix: key.slice(0, 2),
      keyHasWhitespace: /\s/.test(process.env.ALPACA_API_KEY_ID || ""),
      secretHasWhitespace: /\s/.test(process.env.ALPACA_API_SECRET_KEY || ""),
    },
    null,
    2,
  ),
);

const headers = {
  "APCA-API-KEY-ID": key,
  "APCA-API-SECRET-KEY": secret,
};

const account = await fetch("https://paper-api.alpaca.markets/v2/account", { headers });
console.log("paper_account", account.status);

const news = await fetch("https://data.alpaca.markets/v1beta1/news?symbols=AAPL&limit=1", {
  headers,
});
const newsBody = await news.text();
console.log("news", news.status, newsBody.slice(0, 200));
