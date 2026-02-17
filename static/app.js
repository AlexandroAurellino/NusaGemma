"use strict";
const API = "http://127.0.0.1:8000";

let sid = null,
  hist = [],
  docs = {},
  busy = false,
  df = "",
  pollT = null;
try {
  hist = JSON.parse(localStorage.getItem("ng_h")) || [];
} catch (_) {}

const g = (id) => document.getElementById(id);
const feed = g("feed");
const chatWin = g("chatWin");
const welcome = g("welcome");
const inp = g("chatInp");
const sendBtn = g("sendBtn");

/* ── Boot ── */
window.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  fetchDocs();
  renderHist();
  startNewChat();

  inp.addEventListener("input", () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(inp.scrollHeight, 160) + "px";
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const z = g("upZone");
  z.addEventListener("dragover", (e) => {
    e.preventDefault();
    z.style.borderColor = "var(--c-acc)";
  });
  z.addEventListener("dragleave", () => (z.style.borderColor = ""));
  z.addEventListener("drop", (e) => {
    e.preventDefault();
    z.style.borderColor = "";
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".pdf")) upload(f);
  });
  g("pdfInp").addEventListener("change", (e) => {
    if (e.target.files[0]) upload(e.target.files[0]);
    e.target.value = "";
  });
});

/* ── Sidebar ── */
function toggleSB() {
  g("sidebar").classList.toggle("collapsed");
}

/* ── KB Panel ── */
function openKB() {
  g("kbPanel").classList.add("open");
  g("kbOverlay").classList.add("open");
}
function closeKB() {
  g("kbPanel").classList.remove("open");
  g("kbOverlay").classList.remove("open");
}

/* ── Health ── */
async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    if (r.ok) {
      g("sDot").className = "s-dot on";
      g("sTxt").innerText = "System Online";
    } else throw 0;
  } catch {
    g("sDot").className = "s-dot";
    g("sTxt").innerText = "Offline";
    setTimeout(checkHealth, 5000);
  }
}

/* ── Docs ── */
async function fetchDocs() {
  try {
    docs = await (await fetch(`${API}/documents`)).json();
    renderDocs();
    updateStats();
    clearTimeout(pollT);
    if (Object.values(docs).some((d) => d.status === "processing"))
      pollT = setTimeout(fetchDocs, 3000);
  } catch (e) {
    console.error(e);
  }
}

function updateStats() {
  const total = Object.keys(docs).length;
  const active = Object.values(docs).filter(
    (d) => d.enabled && d.status === "ready",
  ).length;
  const chunks = Object.values(docs).reduce((s, d) => s + (d.chunks || 0), 0);
  g("kbBadge").textContent = total;
  g("stTotal").textContent = total;
  g("stActive").textContent = active;
  g("stChunks").textContent = chunks;
}

function filterDocs() {
  df = g("kbSearch").value.toLowerCase();
  renderDocs();
}

function renderDocs() {
  const list = g("docList");
  list.innerHTML = "";
  const empty = g("docEmpty");

  const entries = Object.entries(docs).filter(([n]) =>
    n.toLowerCase().includes(df),
  );
  if (!entries.length) {
    list.appendChild(empty);
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  entries.forEach(([name, info]) => {
    const card = document.createElement("div");
    card.className =
      `doc-card ${info.status} ${!info.enabled ? "dis" : ""}`.trim();

    const icoClass =
      info.status === "processing"
        ? "warn"
        : info.status === "error"
          ? ""
          : "ok";
    const icoHtml =
      info.status === "processing"
        ? `<i class="fa-solid fa-spinner fa-spin"></i>`
        : info.status === "error"
          ? `<i class="fa-solid fa-triangle-exclamation"></i>`
          : `<i class="fa-regular fa-file-pdf"></i>`;
    const badge =
      info.status === "processing"
        ? "Memproses"
        : info.status === "error"
          ? "Error"
          : "Siap";
    const sn = esc(name);

    card.innerHTML = `
<div class="doc-card-top">
  <div class="doc-ico ${icoClass}">${icoHtml}</div>
  <div class="doc-inf">
    <div class="doc-name" title="${sn}">${sn}</div>
    <div class="doc-meta">${info.chunks ? info.chunks + " chunks" : ""}</div>
  </div>
  <span class="doc-badge ${info.status}">${badge}</span>
</div>
${info.status === "processing" ? `<div class="doc-prog"><div class="doc-prog-bar"></div></div>` : ""}
<div class="doc-acts">
  <label class="tog-lbl">
    <input type="checkbox" ${info.enabled ? "checked" : ""} onchange="toggleDoc('${sn}',this.checked)">
    <span class="tog-track"></span>
    <span class="tog-txt">${info.enabled ? "Aktif" : "Nonaktif"}</span>
  </label>
  <button class="doc-del" onclick="delDoc('${sn}')"><i class="fa-solid fa-trash"></i></button>
</div>
`;
    list.appendChild(card);
  });
}

async function toggleDoc(name, en) {
  try {
    await fetch(`${API}/documents/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, enabled: en }),
    });
    if (docs[name]) docs[name].enabled = en;
    updateStats();
    renderDocs();
  } catch {
    alert("Toggle gagal.");
    fetchDocs();
  }
}

async function delDoc(name) {
  if (!confirm(`Hapus "${name}"?`)) return;
  try {
    await fetch(`${API}/documents/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    delete docs[name];
    updateStats();
    renderDocs();
  } catch {
    alert("Hapus gagal.");
  }
}

async function upload(file) {
  docs[file.name] = { enabled: true, status: "processing", chunks: 0 };
  updateStats();
  renderDocs();
  const fd = new FormData();
  fd.append("file", file);
  try {
    const r = await fetch(`${API}/documents/upload?force=true`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) throw 0;
    fetchDocs();
  } catch {
    delete docs[file.name];
    updateStats();
    renderDocs();
    alert("Upload gagal.");
  }
}

/* ── Chat history ── */
function startNewChat() {
  sid = Date.now();
  feed.innerHTML = "";
  welcome.classList.remove("gone");
  renderHist();
}

function renderHist() {
  const ul = g("histList");
  ul.innerHTML = "";
  hist.forEach((s) => {
    const li = document.createElement("li");
    li.className = "hist-item" + (s.id === sid ? " active" : "");
    li.innerHTML = `<span class="hist-item-title">${esc(s.title || "Percakapan baru")}</span>
<span class="hist-item-del" onclick="delSess(event,${s.id})"><i class="fa-solid fa-xmark"></i></span>`;
    li.addEventListener("click", () => loadSess(s.id));
    ul.appendChild(li);
  });
}

function saveMsg(role, text, thought = null, sources = null) {
  let s = hist.find((x) => x.id === sid);
  if (!s) {
    s = {
      id: sid,
      title: text.slice(0, 28) + (text.length > 28 ? "…" : ""),
      messages: [],
    };
    hist.unshift(s);
  } else {
    hist = hist.filter((x) => x.id !== sid);
    hist.unshift(s);
  }
  s.messages.push({ role, text, thought, sources });
  try {
    localStorage.setItem("ng_h", JSON.stringify(hist));
  } catch (_) {}
  renderHist();
}

function loadSess(id) {
  sid = id;
  const s = hist.find((x) => x.id === id);
  if (!s) return;
  feed.innerHTML = "";
  welcome.classList.add("gone");
  s.messages.forEach((m) => {
    if (m.role === "user") {
      addUser(m.text, false);
    } else {
      const b = addAI(false);
      if (m.thought) {
        b.td.closest("details").style.display = "block";
        b.td.textContent = m.thought;
        b.dot.classList.add("done");
      }
      b.txt.innerHTML = fmt(m.text);
      if (m.sources?.length) {
        b.src.style.display = "flex";
        b.src.querySelector("span").innerHTML =
          "<strong>Sumber:</strong> " +
          m.sources.map((s) => `<em>${esc(s)}</em>`).join(", ");
      }
    }
  });
  renderHist();
  scroll();
}

function delSess(e, id) {
  e.stopPropagation();
  hist = hist.filter((s) => s.id !== id);
  try {
    localStorage.setItem("ng_h", JSON.stringify(hist));
  } catch (_) {}
  renderHist();
  if (sid === id) startNewChat();
}

/* ── Send ── */
async function send() {
  const text = inp.value.trim();
  if (!text || busy) return;
  welcome.classList.add("gone");
  addUser(text, true);
  inp.value = "";
  inp.style.height = "auto";
  sendBtn.disabled = true;
  busy = true;

  const b = addAI(true);
  let fThought = "",
    fAnswer = "",
    fSources = [];

  try {
    const resp = await fetch(`${API}/chat-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        use_rag: g("useRag").checked,
      }),
    });
    const reader = resp.body.getReader(),
      dec = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop();
      for (const line of lines) {
        const raw = line.replace(/^data:\s*/, "").trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const d = JSON.parse(raw);
          if (d.type === "thought") {
            fThought += d.content;
            if (b.typing) b.typing.style.display = "none";
            b.td.closest("details").style.display = "block";
            b.td.textContent += d.content;
            b.td.scrollTop = b.td.scrollHeight;
          }
          if (d.type === "final_answer") {
            fAnswer += d.content;
            if (b.typing) b.typing.style.display = "none";
            b.dot.classList.add("done");
            b.txt.innerHTML = fmt(fAnswer);
          }
          if (d.type === "sources" && d.content?.length) {
            fSources = d.content;
            b.src.style.display = "flex";
            b.src.querySelector("span").innerHTML =
              "<strong>Sumber:</strong> " +
              d.content.map((s) => `<em>${esc(s)}</em>`).join(", ");
          }
          scroll();
        } catch (_) {
          fAnswer += raw;
          b.txt.innerHTML = fmt(fAnswer);
        }
      }
    }
    saveMsg("ai", fAnswer, fThought || null, fSources.length ? fSources : null);
  } catch {
    if (b.typing) b.typing.style.display = "none";
    b.txt.innerHTML = `<span style="color:var(--c-err)">⚠️ Koneksi gagal. Pastikan server berjalan.</span>`;
  } finally {
    busy = false;
    sendBtn.disabled = false;
    inp.focus();
  }
}

function useChip(el) {
  inp.value = el.textContent.trim();
  inp.dispatchEvent(new Event("input"));
  inp.focus();
}

/* ── DOM helpers ── */
function addUser(text, save = false) {
  const d = document.createElement("div");
  d.className = "msg-u";
  d.innerHTML = `<div class="bubble-u">${esc(text)}</div>`;
  feed.appendChild(d);
  scroll();
  if (save) saveMsg("user", text);
}

function addAI(withTyping = false) {
  const d = document.createElement("div");
  d.className = "msg-a";
  d.innerHTML = `
<div class="ai-ava"><i class="fa-solid fa-staff-snake"></i></div>
<div class="ai-body">
<details class="thought-details" style="display:none">
  <summary class="thought-summary">
    <div class="thought-dot"></div>
    Proses Pemikiran AI
  </summary>
  <div class="thought-body"></div>
</details>
${withTyping ? `<div class="typing"><span></span><span></span><span></span></div>` : ""}
<div class="ai-txt"></div>
<div class="sources" style="display:none"><i class="fa-solid fa-book-open"></i><span></span></div>
</div>`;
  feed.appendChild(d);
  scroll();
  return {
    txt: d.querySelector(".ai-txt"),
    td: d.querySelector(".thought-body"),
    dot: d.querySelector(".thought-dot"),
    src: d.querySelector(".sources"),
    typing: d.querySelector(".typing"),
  };
}

function scroll() {
  chatWin.scrollTop = chatWin.scrollHeight;
}
function esc(s) {
  return s
    ? s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
    : "";
}
function fmt(t) {
  return esc(t)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
