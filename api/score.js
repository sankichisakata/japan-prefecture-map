import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const forwarded = req.headers["x-forwarded-for"] || "";
  const ip = (forwarded.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
  const key = `hs:${ip}`;

  if (req.method === "GET") {
    const val = await redis.get(key);
    return res.json({ highScore: val ?? 0 });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const score = Number(body?.score);
    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "invalid score" });
    }
    const current = (await redis.get(key)) ?? 0;
    const best = Math.max(score, current);
    // TTL: 24時間（最終アクセスから24h後に自動削除）
    if (best > current) await redis.setex(key, 86400, best);
    return res.json({ highScore: best });
  }

  res.status(405).end();
}
