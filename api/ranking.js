import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  try {
    // スコア降順でトップ20を取得
    const items = await redis.zrange("ranking", 0, 19, { rev: true, withScores: true });

    const ranking = [];
    for (const item of items) {
      const user = await redis.hgetall(`user:${item.member}`);
      ranking.push({
        rank: ranking.length + 1,
        pref: user?.pref || "不明",
        time: user?.time || "--/-- --:--",
        score: item.score,
      });
    }
    return res.json({ ranking });
  } catch (e) {
    console.error(e);
    return res.json({ ranking: [] });
  }
}
