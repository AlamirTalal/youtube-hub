// ===== الترجمة =====
const i18n = {
  ar: {
    dir: "rtl",
    appName: "YouTube Hub",
    searchPlaceholder: "ابحث عن فيديو أو مجال...",
    searchBtn: "بحث",
    tabHome: "الرئيسية",
    tabLikes: "اللايكات",
    tabHistory: "السجل",
    tabFollows: "المجالات",
    all: "الكل",
    loading: "جاري التحميل...",
    noResults: "مفيش نتايج",
    noItems: "مفيش حاجة هنا لسه",
    error: "حصل خطأ، حاول تاني",
    like: "إعجاب",
    liked: "أعجبني",
    follow: "اشتراك",
    following: "مشترك",

    channel: "القناة",
  },
  en: {
    dir: "ltr",
    appName: "YouTube Hub",
    searchPlaceholder: "Search for a video or topic...",
    searchBtn: "Search",
    tabHome: "Home",
    tabLikes: "Likes",
    tabHistory: "History",
    tabFollows: "Topics",
    all: "All",
    loading: "Loading...",
    noResults: "No results",
    noItems: "Nothing here yet",
    error: "Something went wrong, try again",
    like: "Like",
    liked: "Liked",
    follow: "Subscribe",
    following: "Subscribed",
    channel: "Channel",
  },
};

const categoriesList = [
  { key: "programming", ar: "برمجة", en: "Programming", q: "programming tutorial" },
  { key: "cooking", ar: "طبخ", en: "Cooking", q: "cooking recipes" },
  { key: "history", ar: "تاريخ", en: "History", q: "history documentary" },
  { key: "languages", ar: "لغات", en: "Languages", q: "learn language" },
  { key: "science", ar: "علوم", en: "Science", q: "science explained" },
  { key: "fitness", ar: "رياضة", en: "Fitness", q: "fitness workout" },
];

// ===== الحالة والتخزين المحلي =====
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

let lang = store.get("lang", "ar");
let theme = store.get("theme", "light");
let likes = store.get("likes", {});       // { videoId: videoData }
let history = store.get("history", []);   // [videoData] أحدث الأول
let follows = store.get("follows", {});   // { channelId: { title, url, thumb } }

let currentQuery = "";
let nextPageToken = null;
let loading = false;
let currentView = "home";
let currentVideos = [];
let activeCategory = null;

const $ = (sel) => document.querySelector(sel);
const t = (key) => i18n[lang][key] || key;

// ===== الترجمة والثيم =====
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = i18n[lang].dir;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  $("#langBtn").textContent = lang === "ar" ? "EN" : "عربي";
  renderCategories();
  renderCurrentView();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("#themeBtn").textContent = theme === "dark" ? "☀️" : "🌙";
}

$("#langBtn").addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  store.set("lang", lang);
  applyLang();
});

$("#themeBtn").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  store.set("theme", theme);
  applyTheme();
});

// ===== التصنيفات =====
function renderCategories() {
  const nav = $("#categories");
  nav.innerHTML = "";
  categoriesList.forEach((c) => {
    const btn = document.createElement("button");
    btn.textContent = lang === "ar" ? c.ar : c.en;
    if (activeCategory === c.key) btn.classList.add("active");
    btn.onclick = () => {
      activeCategory = c.key;
      switchView("home");
      search(c.q, true);
      renderCategories();
    };
    nav.appendChild(btn);
  });
}

// ===== البحث وجلب الفيديوهات =====
$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  if (!q) return;
  activeCategory = null;
  renderCategories();
  switchView("home");
  search(q, true);
});

async function search(q, reset) {
  if (loading) return;
  if (reset) {
    currentQuery = q;
    nextPageToken = null;
    currentVideos = [];
    $("#results").innerHTML = "";
  }
  if (!currentQuery) return;

  loading = true;
  setStatus(t("loading"));

  try {
    const params = new URLSearchParams({ q: currentQuery });
    if (nextPageToken) params.set("pageToken", nextPageToken);
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    nextPageToken = data.nextPageToken;
    currentVideos = currentVideos.concat(data.items);
    appendCards(data.items);
    setStatus(
      currentVideos.length === 0 ? t("noResults") : nextPageToken ? "" : ""
    );
  } catch (err) {
    setStatus(t("error"));
  } finally {
    loading = false;
  }
}

// ===== الكروت =====
function shortDesc(text) {
  const clean = (text || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return clean.length > 140 ? clean.slice(0, 140) + "..." : clean;
}

function appendCards(items) {
  const grid = $("#results");
  items.forEach((v) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${v.thumbnail}" alt="" loading="lazy" />
      <div class="card-title"></div>
      <a class="card-channel" target="_blank" rel="noopener"></a>
      <div class="card-desc"></div>
    `;
    card.querySelector(".card-title").textContent = v.title;
    const ch = card.querySelector(".card-channel");
    ch.textContent = v.channelTitle;
    ch.href = v.channelUrl;
    ch.onclick = (e) => e.stopPropagation();
    card.querySelector(".card-desc").textContent = shortDesc(v.description);
    card.onclick = () => openPlayer(v);
    grid.appendChild(card);
  });
}

function setStatus(msg) {
  $("#status").textContent = msg;
}

// ===== Infinite scroll =====
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && nextPageToken && currentView === "home") {
    search(null, false);
  }
});
observer.observe($("#sentinel"));

// ===== صفحة الفيديو =====
function openPlayer(v) {
  addToHistory(v);
  $("#videoFrame").src = `https://www.youtube.com/embed/${v.id}`;
  $("#playerTitle").textContent = v.title;
  const ch = $("#playerChannel");
  ch.textContent = v.channelTitle;
  ch.href = v.channelUrl;
  $("#playerDesc").textContent = v.description || "";
  renderPlayerButtons(v);
  $("#player").classList.remove("hidden");
}

$("#closePlayer").addEventListener("click", () => {
  $("#player").classList.add("hidden");
  $("#videoFrame").src = "";
});

function renderPlayerButtons(v) {
  const likeBtn = $("#likeBtn");
  const followBtn = $("#followBtn");
  likeBtn.textContent = likes[v.id] ? t("liked") : t("like");
  likeBtn.onclick = () => toggleLike(v);
  followBtn.textContent = follows[v.channelId] ? t("following") : t("follow");
  followBtn.onclick = () => toggleFollow(v);
}

// ===== اللايكات والسجل والمتابعة =====
function toggleLike(v) {
  if (likes[v.id]) delete likes[v.id];
  else likes[v.id] = v;
  store.set("likes", likes);
  renderPlayerButtons(v);
}

function addToHistory(v) {
  history = history.filter((h) => h.id !== v.id);
  history.unshift(v);
  history = history.slice(0, 100);
  store.set("history", history);
}

function toggleFollow(v) {
  if (follows[v.channelId]) delete follows[v.channelId];
  else
    follows[v.channelId] = {
      title: v.channelTitle,
      url: v.channelUrl,
    };
  store.set("follows", follows);
  renderPlayerButtons(v);
}

// ===== التابات =====
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  renderCurrentView();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function renderCurrentView() {
  const grid = $("#results");
  grid.innerHTML = "";
  setStatus("");

  if (currentView === "home") {
    appendCards(currentVideos);
    if (!currentQuery) setStatus(t("noItems"));
    return;
  }

  if (currentView === "likes") {
    const list = Object.values(likes);
    list.length ? appendCards(list) : setStatus(t("noItems"));
    return;
  }

  if (currentView === "history") {
    history.length ? appendCards(history) : setStatus(t("noItems"));
    return;
  }

  if (currentView === "follows") {
    const list = Object.entries(follows);
    if (!list.length) return setStatus(t("noItems"));
    list.forEach(([channelId, ch]) => {
      const row = document.createElement("div");
      row.className = "card";
      row.innerHTML = `<div class="card-title"></div>`;
      row.querySelector(".card-title").textContent = ch.title;
      row.onclick = () => window.open(ch.url, "_blank");
      grid.appendChild(row);
    });
  }
}

// ===== البداية =====
applyTheme();
applyLang();
