// سيرفر محلي للتجربة السريعة: ملفات ثابتة + /api/search وهمي (من غير مفتاح يوتيوب).
// التشغيل: npm run dev:mock  ثم افتح http://localhost:4321
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 4321);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const CHANNELS = [
  "Elzero Web School", "Academind", "Fireship", "Traversy Media",
  "Codevolution", "قناة الدروس", "عالم التقنية", "Tech With Tim",
  "The Net Ninja", "Web Dev Simplified",
];

const TITLE_WORDS = ["شرح", "كورس", "تعلم", "Tutorial", "أساسيات", "Masterclass", "Crash Course", "دليل"];

function thumb(seed, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 45%)"/>
<stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 25%)"/>
</linearGradient></defs>
<rect width="480" height="270" fill="url(#g)"/>
<circle cx="240" cy="128" r="34" fill="rgba(255,255,255,.9)"/>
<path d="M228 111l30 17-30 17z" fill="hsl(${hue} 70% 35%)"/>
<text x="16" y="252" font-family="sans-serif" font-size="15" fill="rgba(255,255,255,.85)">${seed}</text>
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function makeItems(query, page) {
  const seed = `${query}-${page}`;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const count = 20;

  return Array.from({ length: count }, (_, i) => {
    const hue = (h + i * 37) % 360;
    const id = `vid${(h + i * 13) % 9999}x${page}${i}`;
    const days = ((h + i * 11) % 900) + 1;
    return {
      id,
      title: `${TITLE_WORDS[(h + i) % TITLE_WORDS.length]} ${query} — ${i % 3 === 0 ? "Part" : "الجزء"} ${(i % 20) + 1}`,
      description: `فيديو عن ${query}. شرح كامل ومبسط خطوة بخطوة مع أمثلة عملية. ${"محتوى تجريبي. ".repeat(6)}`,
      thumbnail: thumb(id, hue),
      channelId: `UC${(h + i * 7) % 500}chan`,
      channelTitle: CHANNELS[(h + i) % CHANNELS.length],
      channelUrl: "#",
      publishedAt: new Date(Date.now() - days * 864e5).toISOString(),
      duration: 61 + ((h + i * 53) % 3500),
      views: 1000 + ((h + i * 7919) % 2_000_000),
    };
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) {
      res.writeHead(400, { "Content-Type": MIME[".json"] });
      return res.end(JSON.stringify({ error: "Missing query" }));
    }
    const page = Number(url.searchParams.get("pageToken") || 0) || 0;
    const body = JSON.stringify({
      items: makeItems(q, page),
      nextPageToken: page < 2 ? String(page + 1) : null,
    });
    res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
    return res.end(body);
  }

  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(normalize(ROOT))) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`FakeTube mock: http://localhost:${PORT}`);
});
