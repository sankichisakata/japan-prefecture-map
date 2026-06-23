import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  try {
    const items = await redis.zrange("ranking", 0, 19, { rev: true, withScores: true });

    const ranking = [];
    for (const item of items) {
      const member = item.member ?? item;
      const itemScore = item.score;
      const user = await redis.hgetall(`user:${member}`);
      ranking.push({
        rank: ranking.length + 1,
        num: Number(user?.num) || null,
        location: user?.location || user?.pref || "不明",
        time: user?.time || "--/-- --:--",
        score: itemScore ?? Number(user?.score) ?? 0,
      });
    }
    return res.json({ ranking });
  } catch (e) {
    console.error(e);
    return res.json({ ranking: [] });
  }
}
