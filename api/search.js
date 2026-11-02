const ORDERS = ["relevance", "date", "viewCount", "rating"];
const MAX_QUERY_LENGTH = 200;

// حماية بسيطة (best-effort) من استهلاك الحصة: كل IP له حد أقصى في الدقيقة.
// على Vercel الذاكرة لكل instance، فهي طبقة أولى مش حماية كاملة — راجع README.
const RATE = { windowMs: 60_000, max: 40 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((ts) => now - ts < RATE.windowMs);
  if (recent.length >= RATE.max) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function parseDuration(iso) {
  const m = (iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h = 0, min = 0, s = 0] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s);
}

export default async function handler(req, res) {
  const { q, pageToken, lang, order } = req.query;
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const query = typeof q === "string" ? q.trim() : "";
  if (!query) return res.status(400).json({ error: "Missing query" });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: "Query too long" });
  }

  if (rateLimited(clientIp(req))) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests" });
  }

  try {
    // 1) البحث (بيكلف 100 وحدة من الحصة اليومية)
    //    maxResults=50 بياخد أقصى عدد من النتائج بنفس التكلفة.
    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "50",
      q: query,
      order: ORDERS.includes(order) ? order : "relevance",
      videoEmbeddable: "true",
      key,
    });
    if (lang && /^[a-z]{2}$/.test(lang)) searchParams.set("relevanceLanguage", lang);
    if (pageToken) searchParams.set("pageToken", pageToken);

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`
    );
    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      return res
        .status(searchRes.status)
        .json({ error: searchData.error?.message || "YouTube error" });
    }

    const ids = (searchData.items || []).map((i) => i.id?.videoId).filter(Boolean);
    if (ids.length === 0) {
      return res.json({ items: [], nextPageToken: searchData.nextPageToken || null });
    }

    // 2) تفاصيل الفيديوهات (وحدة واحدة بس) عشان المدة والمشاهدات والوصف
    const detailsParams = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: ids.join(","),
      key,
    });
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`
    );
    const detailsData = await detailsRes.json();
    if (!detailsRes.ok) {
      return res
        .status(detailsRes.status)
        .json({ error: detailsData.error?.message || "YouTube error" });
    }

    // 3) استبعاد الشورتس (أقل من أو يساوي 60 ثانية) وتجهيز البيانات
    const items = (detailsData.items || [])
      .map((v) => {
        const duration = parseDuration(v.contentDetails?.duration);
        return {
          id: v.id,
          title: v.snippet.title,
          description: v.snippet.description,
          thumbnail:
            v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url,
          channelId: v.snippet.channelId,
          channelTitle: v.snippet.channelTitle,
          channelUrl: `https://www.youtube.com/channel/${v.snippet.channelId}`,
          publishedAt: v.snippet.publishedAt,
          duration,
          views: Number(v.statistics?.viewCount) || 0,
        };
      })
      .filter((v) => v.duration > 60);

    // كاش على Vercel (بيختلف حسب الكلمة واللغة والترتيب)
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.json({ items, nextPageToken: searchData.nextPageToken || null });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}
