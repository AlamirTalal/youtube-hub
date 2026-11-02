function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h = 0, min = 0, s = 0] = m;
  return Number(h) * 3600 + Number(min) * 60 + Number(s);
}

export default async function handler(req, res) {
  const { q, pageToken } = req.query;
  const key = process.env.YOUTUBE_API_KEY;

  if (!key) return res.status(500).json({ error: "API key not configured" });
  if (!q || !q.trim()) return res.status(400).json({ error: "Missing query" });

  try {
    // 1) البحث (بيكلف 100 وحدة من الحصة اليومية)
    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "30",
      q: q.trim(),
      key,
    });
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

    const ids = searchData.items.map((i) => i.id.videoId).filter(Boolean);
    if (ids.length === 0) {
      return res.json({ items: [], nextPageToken: searchData.nextPageToken || null });
    }

    // 2) تفاصيل الفيديوهات (بتكلف وحدة واحدة بس) عشان المدة والوصف
    const detailsParams = new URLSearchParams({
      part: "snippet,contentDetails",
      id: ids.join(","),
      key,
    });
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`
    );
    const detailsData = await detailsRes.json();

    // 3) استبعاد الشورتس (أقل من أو يساوي 60 ثانية) وتجهيز البيانات
    const items = detailsData.items
      .filter((v) => parseDuration(v.contentDetails.duration) > 60)
      .map((v) => ({
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        thumbnail:
          v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        channelUrl: `https://www.youtube.com/channel/${v.snippet.channelId}`,
      }));

    // كاش على مستوى Vercel عشان نوفر الحصة لو حد بحث نفس الكلمة
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.json({ items, nextPageToken: searchData.nextPageToken || null });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}
