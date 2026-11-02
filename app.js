// ===== الترجمة =====
const i18n = {
  ar: {
    dir: "rtl",
    appName: "FakeTube",
    searchPlaceholder: "ابحث عن فيديو أو مجال...",
    tabHome: "الرئيسية",
    tabLikes: "اللايكات",
    tabHistory: "السجل",
    tabFollows: "المجالات",
    forYou: "مخصص لك",
    editProfile: "تعديل اهتماماتي",
    welcomeTitle: "أهلاً بيك",
    welcomeSub: "اختار اهتماماتك عشان نجهز لك الفيد",
    pickInterests: "إيه اللي بيهمك؟",
    pickPrimary: "لغتك المفضلة",
    pickOthers: "لغات تانية تحب تشوفها",
    start: "ابدأ",
    loading: "جاري التحميل...",
    noResults: "مفيش نتايج",
    noItems: "مفيش حاجة هنا لسه",
    error: "حصل خطأ، حاول تاني",
    like: "إعجاب",
    liked: "أعجبني",
    follow: "اشتراك",
    following: "مشترك",
  },
  en: {
    dir: "ltr",
    appName: "FakeTube",
    searchPlaceholder: "Search for a video or topic...",
    tabHome: "Home",
    tabLikes: "Likes",
    tabHistory: "History",
    tabFollows: "Topics",
    forYou: "For you",
    editProfile: "Edit my interests",
    welcomeTitle: "Welcome",
    welcomeSub: "Pick your interests so we can build your feed",
    pickInterests: "What are you into?",
    pickPrimary: "Your preferred language",
    pickOthers: "Other languages you'd like to see",
    start: "Start",
    loading: "Loading...",
    noResults: "No results",
    noItems: "Nothing here yet",
    error: "Something went wrong, try again",
    like: "Like",
    liked: "Liked",
    follow: "Subscribe",
    following: "Subscribed",
  },
};

const LANGS = [
  { code: "ar", ar: "العربية", en: "Arabic" },
  { code: "en", ar: "الإنجليزية", en: "English" },
];

// كل اهتمام وله كلمات بحث بكل لغة
const INTERESTS = [
  {
    key: "programming", ar: "برمجة", en: "Programming",
    terms: {
      ar: ["شرح برمجة للمبتدئين", "تعلم البرمجة من الصفر", "تطوير المواقع بالعربي"],
      en: ["programming tutorial for beginners", "learn coding from scratch", "web development tutorial"],
    },
  },
  {
    key: "design", ar: "تصميم", en: "Design",
    terms: {
      ar: ["تعلم التصميم الجرافيك", "شرح Figma للمبتدئين"],
      en: ["graphic design tutorial", "UI design tutorial"],
    },
  },
  {
    key: "cooking", ar: "طبخ", en: "Cooking",
    terms: {
      ar: ["وصفات طبخ سهلة", "طريقة عمل أكلة في البيت"],
      en: ["easy cooking recipes", "homemade recipe step by step"],
    },
  },
  {
    key: "history", ar: "تاريخ", en: "History",
    terms: {
      ar: ["وثائقي تاريخ", "تاريخ الحضارات"],
      en: ["history documentary", "ancient history explained"],
    },
  },
  {
    key: "languages", ar: "لغات", en: "Languages",
    terms: {
      ar: ["تعلم اللغة الإنجليزية", "تعلم لغة من الصفر"],
      en: ["learn english", "learn a language fast"],
    },
  },
  {
    key: "science", ar: "علوم", en: "Science",
    terms: {
      ar: ["العلوم مبسطة", "شرح ظواهر علمية"],
      en: ["science explained", "physics explained simply"],
    },
  },
  {
    key: "fitness", ar: "رياضة", en: "Fitness",
    terms: {
      ar: ["تمارين رياضة في البيت", "تمرين بناء عضلات"],
      en: ["home workout", "strength training for beginners"],
    },
  },
  {
    key: "business", ar: "أعمال", en: "Business",
    terms: {
      ar: ["ازاي تبدأ مشروع", "التسويق الرقمي"],
      en: ["how to start a business", "digital marketing tutorial"],
    },
  },
];

// ===== التخزين المحلي =====
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
let profile = store.get("profile", { onboarded: false, interests: [], primary: "ar", others: [] });
let scores = store.get("scores", {});
let likes = store.get("likes", {});
let history = store.get("history", []);
let follows = store.get("follows", {});
const seenSet = new Set(store.get("seen", []));

let mode = "feed";            // feed | search
let activeInterest = null;
let currentQuery = "";
let currentLang = null;
let nextPageToken = null;
let loading = false;
let currentView = "home";
let currentVideos = [];
let draft = null;

const $ = (sel) => document.querySelector(sel);
const t = (key) => i18n[lang][key] || key;
const label = (obj) => (lang === "ar" ? obj.ar : obj.en);

// ===== أدوات مساعدة =====
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// اختيار عشوائي مرجّح بالوزن من غير تكرار
function weightedSample(items, weights, n) {
  const pool = items.map((item, i) => ({ item, w: weights[i] }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    out.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return out;
}

function uniqById(arr) {
  const m = new Map();
  arr.forEach((v) => { if (!m.has(v.id)) m.set(v.id, v); });
  return [...m.values()];
}

function trimSeen() {
  while (seenSet.size > 500) seenSet.delete(seenSet.values().next().value);
  store.set("seen", [...seenSet]);
}

function addScore(v, n) {
  if (!v._interest) return;
  scores[v._interest] = Math.max(0, (scores[v._interest] || 0) + n);
  store.set("scores", scores);
}

function pickLang() {
  if (!profile.others.length || Math.random() < 0.7) return profile.primary;
  return randomItem(profile.others);
}

function termsFor(interest, code) {
  return interest.terms[code] || interest.terms.en;
}

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
  renderWelcome();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("#themeBtn .material-symbols-rounded").textContent =
    theme === "dark" ? "light_mode" : "dark_mode";
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

// ===== صفحة الترحيب =====
function openWelcome() {
  draft = {
    interests: new Set(profile.interests),
    primary: profile.primary,
    others: new Set(profile.others),
  };
  $("#welcomeClose").classList.toggle("hidden", !profile.onboarded);
  $("#welcome").classList.remove("hidden");
  renderWelcome();
}

function closeWelcome() {
  $("#welcome").classList.add("hidden");
}

function toggleSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function makeOpt(container, text, selected, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "opt" + (selected ? " selected" : "");
  b.textContent = text;
  b.onclick = () => {
    onClick();
    renderWelcome();
  };
  container.appendChild(b);
}

function renderWelcome() {
  if (!draft) return;

  const ints = $("#interestOptions");
  ints.innerHTML = "";
  INTERESTS.forEach((i) =>
    makeOpt(ints, label(i), draft.interests.has(i.key), () => toggleSet(draft.interests, i.key))
  );

  const prim = $("#primaryOptions");
  prim.innerHTML = "";
  LANGS.forEach((l) =>
    makeOpt(prim, label(l), draft.primary === l.code, () => {
      draft.primary = l.code;
      draft.others.delete(l.code);
    })
  );

  const oth = $("#otherOptions");
  oth.innerHTML = "";
  LANGS.filter((l) => l.code !== draft.primary).forEach((l) =>
    makeOpt(oth, label(l), draft.others.has(l.code), () => toggleSet(draft.others, l.code))
  );

  $("#startBtn").disabled = draft.interests.size === 0;
}

$("#startBtn").addEventListener("click", () => {
  profile = {
    onboarded: true,
    interests: [...draft.interests],
    primary: draft.primary,
    others: [...draft.others],
  };
  store.set("profile", profile);
  closeWelcome();
  resetFeed();
});

$("#welcomeClose").addEventListener("click", closeWelcome);

$("#editProfileBtn").addEventListener("click", () => {
  document.body.classList.remove("sidebar-open");
  openWelcome();
});

// ===== التصنيفات (اهتماماتك مرتبة حسب تفاعلك) =====
function chipInterests() {
  const selected = INTERESTS.filter((i) => profile.interests.includes(i.key));
  const suggested = INTERESTS.filter(
    (i) => !profile.interests.includes(i.key) && (scores[i.key] || 0) > 0
  );
  return [...selected, ...suggested].sort(
    (a, b) => (scores[b.key] || 0) - (scores[a.key] || 0)
  );
}

function renderCategories() {
  const nav = $("#categories");
  nav.innerHTML = "";

  const feedChip = document.createElement("button");
  feedChip.textContent = t("forYou");
  if (mode === "feed") feedChip.classList.add("active");
  feedChip.onclick = () => resetFeed();
  nav.appendChild(feedChip);

  chipInterests().forEach((i) => {
    const b = document.createElement("button");
    b.textContent = label(i);
    if (mode === "search" && activeInterest === i.key) b.classList.add("active");
    b.onclick = () => openInterest(i.key);
    nav.appendChild(b);
  });
}

function openInterest(key) {
  const interest = INTERESTS.find((i) => i.key === key);
  activeInterest = key;
  search(randomItem(termsFor(interest, profile.primary)), true, profile.primary);
  switchView("home");
  renderCategories();
}

// ===== الفيد المخصص =====
async function fetchVideos(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const res = await fetch(`/api/search?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

function resetFeed() {
  mode = "feed";
  activeInterest = null;
  currentQuery = "";
  currentLang = null;
  nextPageToken = null;
  currentVideos = [];
  $("#results").innerHTML = "";
  switchView("home");
  renderCategories();
  loadFeed();
}

async function loadFeed() {
  if (loading) return;
  loading = true;
  setStatus(t("loading"));

  try {
    const pool = profile.interests.length
      ? profile.interests
      : INTERESTS.map((i) => i.key);
    const weights = pool.map((k) => 1 + (scores[k] || 0));
    const picks = weightedSample(pool, weights, 3).map((k) =>
      INTERESTS.find((i) => i.key === k)
    );
    const order = randomItem(["relevance", "relevance", "date", "viewCount"]);

    const jobs = picks.map(async (interest) => {
      const code = pickLang();
      const data = await fetchVideos({
        q: randomItem(termsFor(interest, code)),
        lang: code,
        order,
      });
      return data.items.map((v) => ({ ...v, _interest: interest.key }));
    });

    const results = (await Promise.all(jobs)).flat();
    const fresh = shuffle(uniqById(results)).filter((v) => !seenSet.has(v.id));
    fresh.forEach((v) => seenSet.add(v.id));
    trimSeen();

    currentVideos = currentVideos.concat(fresh);
    if (currentView === "home") appendCards(fresh);
    setStatus(currentVideos.length ? "" : t("noResults"));
  } catch {
    setStatus(t("error"));
  } finally {
    loading = false;
  }
}

// ===== البحث =====
$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  if (!q) return;
  activeInterest = null;
  search(q, true);
  switchView("home");
  renderCategories();
});

async function search(q, reset, langCode) {
  if (loading) return;
  if (reset) {
    mode = "search";
    currentQuery = q;
    currentLang = langCode || null;
    nextPageToken = null;
    currentVideos = [];
    $("#results").innerHTML = "";
  }
  if (!currentQuery) return;

  loading = true;
  setStatus(t("loading"));

  try {
    const data = await fetchVideos({
      q: currentQuery,
      lang: currentLang,
      pageToken: nextPageToken,
    });
    nextPageToken = data.nextPageToken;
    currentVideos = currentVideos.concat(data.items);
    if (currentView === "home") appendCards(data.items);
    setStatus(currentVideos.length === 0 ? t("noResults") : "");
  } catch {
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
  if (!entries[0].isIntersecting || currentView !== "home") return;
  if (mode === "feed") loadFeed();
  else if (nextPageToken) search(null, false);
});
observer.observe($("#sentinel"));

// ===== صفحة الفيديو =====
function openPlayer(v) {
  addToHistory(v);
  addScore(v, 1);
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
  const liked = !!likes[v.id];
  const following = !!follows[v.channelId];

  likeBtn.innerHTML = `<span class="material-symbols-rounded">${liked ? "thumb_up" : "thumb_up_off_alt"}</span><span>${liked ? t("liked") : t("like")}</span>`;
  likeBtn.onclick = () => toggleLike(v);

  followBtn.textContent = following ? t("following") : t("follow");
  followBtn.className = following ? "subscribed" : "subscribe";
  followBtn.onclick = () => toggleFollow(v);
}

// ===== اللايكات والسجل والمتابعة =====
function toggleLike(v) {
  if (likes[v.id]) {
    delete likes[v.id];
    addScore(v, -3);
  } else {
    likes[v.id] = v;
    addScore(v, 3);
  }
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
  if (follows[v.channelId]) {
    delete follows[v.channelId];
    addScore(v, -5);
  } else {
    follows[v.channelId] = { title: v.channelTitle, url: v.channelUrl };
    addScore(v, 5);
  }
  store.set("follows", follows);
  renderPlayerButtons(v);
}

// ===== التابات =====
function switchView(view) {
  document.body.classList.remove("sidebar-open");
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

// ===== القائمة الجانبية =====
$("#menuBtn").addEventListener("click", () => {
  if (window.innerWidth <= 900) document.body.classList.toggle("sidebar-open");
  else document.body.classList.toggle("sidebar-collapsed");
});

// ===== البداية =====
applyTheme();
applyLang();
if (!profile.onboarded) openWelcome();
else resetFeed();
