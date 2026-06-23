import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

async function getPrefecture(ip) {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return "不明（ローカル）";
  }
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?lang=ja&fields=regionName`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return "不明";
    const data = await r.json();
    return data.regionName || "不明";
  } catch {
    return "不明";
  }
}

function timestamp() {
  const d = new Date();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h   = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const forwarded = req.headers["x-forwarded-for"] || "";
  const ip = (forwarded.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();

  if (req.method === "GET") {
    try {
      const val = await redis.get(`hs:${ip}`);
      return res.json({ highScore: val ?? 0 });
    } catch {
      return res.json({ highScore: 0 });
    }
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const score = Number(body?.score);
    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "invalid score" });
    }
    try {
      const current = (await redis.get(`hs:${ip}`)) ?? 0;
      const best = Math.max(score, current);
      const pref = await getPrefecture(ip);
      const time = timestamp();

      // 常に最新の都道府県と時刻で更新（スコアは最高値のみ）
      await redis.setex(`hs:${ip}`, 86400, best);
      await redis.zadd("ranking", { score: best, member: ip });
      await redis.hset(`user:${ip}`, { pref, time, score: best });
      await redis.expire(`user:${ip}`, 86400);

      return res.json({ highScore: best });
    } catch (e) {
      console.error(e);
      return res.json({ highScore: score });
    }
  }

  res.status(405).end();
}
