"use strict";
const API = "";

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
  const panel = g("kbPanel");
  const overlay = g("kbOverlay");

  // 1. Matikan efek transisi/animasi geser sementara
  panel.style.transition = "none";
  overlay.style.transition = "none";

  // 2. Buka panel secara instan jika status sebelumnya 'open'
  if (localStorage.getItem("kbState") === "open") {
    panel.classList.add("open");
    overlay.classList.add("open");
  }

  // 3. Paksa browser membaca ulang tata letak (reflow) agar posisi instan terkunci
  void panel.offsetWidth;

  // 4. Kembalikan efek transisi agar tombol close/open manual tetap punya animasi
  panel.style.transition = "";
  overlay.style.transition = "";

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
  // Simpan status bahwa panel sedang terbuka di memory browser
  localStorage.setItem("kbState", "open");
}

function closeKB() {
  g("kbPanel").classList.remove("open");
  g("kbOverlay").classList.remove("open");
  // Hapus status saat panel ditutup
  localStorage.setItem("kbState", "closed");
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
    const response = await fetch(`${API}/documents`);
    if (!response.ok) throw new Error("Failed to fetch documents");

    const data = await response.json();

    // Compatibility Check: If backend returns an array, convert to object
    if (Array.isArray(data)) {
      docs = {};
      data.forEach((d) => {
        docs[d.filename] = {
          status: d.status || "ready",
          enabled: d.enabled ?? true,
          chunks: d.chunks || 0,
        };
      });
    } else {
      docs = data;
    }

    renderDocs();
    updateStats();

    // Poll if any document is still processing
    clearTimeout(pollT);
    const isProcessing = Object.values(docs).some(
      (d) => d.status === "processing",
    );
    if (isProcessing) {
      pollT = setTimeout(fetchDocs, 3000);
    }
  } catch (e) {
    console.error("Knowledge Base Error:", e);
    g("sTxt").innerText = "KB Sync Error";
  }
}

/* ── Update Stats ── */
function updateStats() {
  // Memastikan docs adalah object sebelum dihitung
  const docsArray = Object.values(docs || {});

  const total = docsArray.length;
  const active = docsArray.filter(
    (d) => d.enabled && (d.status === "ready" || d.status === "Siap"),
  ).length;
  const chunks = docsArray.reduce((s, d) => s + (d.chunks || 0), 0);

  g("kbBadge").textContent = total;
  g("stTotal").textContent = total;
  g("stActive").textContent = active;
  g("stChunks").textContent = chunks;
}

/* ── Render Docs ── */
function renderDocs() {
  const list = g("docList");
  const empty = g("docEmpty");

  // Hapus semua elemen card, tapi JANGAN hapus elemen 'docEmpty'
  Array.from(list.children).forEach((child) => {
    if (child.id !== "docEmpty") {
      child.remove();
    }
  });

  const entries = Object.entries(docs).filter(([n]) =>
    n.toLowerCase().includes(df),
  );

  // Jika tidak ada dokumen, tampilkan pesan kosong
  if (entries.length === 0) {
    empty.style.display = "flex";
    return;
  }

  // Sembunyikan pesan kosong jika ada dokumen
  empty.style.display = "none";

  entries.forEach(([name, info]) => {
    const card = document.createElement("div");
    const status = info.status || "ready";
    card.className = `doc-card ${status} ${!info.enabled ? "dis" : ""}`.trim();

    let icoHtml = `<i class="fa-regular fa-file-pdf"></i>`;
    let icoClass = "ok";
    let badgeTxt = "Siap";

    if (status === "processing") {
      icoHtml = `<i class="fa-solid fa-spinner fa-spin"></i>`;
      icoClass = "warn";
      badgeTxt = "Memproses";
    } else if (status === "error") {
      icoHtml = `<i class="fa-solid fa-triangle-exclamation"></i>`;
      icoClass = "";
      badgeTxt = "Error";
    }

    const sn = esc(name);
    card.innerHTML = `
      <div class="doc-card-top">
        <div class="doc-ico ${icoClass}">${icoHtml}</div>
        <div class="doc-inf">
          <div class="doc-name" title="${sn}">${sn}</div>
          <div class="doc-meta">${info.chunks ? info.chunks + " chunks" : "0 chunks"}</div>
        </div>
        <span class="doc-badge ${status}">${badgeTxt}</span>
      </div>
      ${status === "processing" ? `<div class="doc-prog"><div class="doc-prog-bar"></div></div>` : ""}
      <div class="doc-acts">
        <label class="tog-lbl">
          <input type="checkbox" ${info.enabled ? "checked" : ""} onchange="toggleDoc('${sn}', this.checked)">
          <span class="tog-track"></span>
          <span class="tog-txt">${info.enabled ? "Aktif" : "Nonaktif"}</span>
        </label>
        <button class="doc-del" onclick="delDoc('${sn}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    list.appendChild(card);
  });
}

/* ── Toggle Doc ── */
async function toggleDoc(name, en) {
  try {
    const response = await fetch(`${API}/documents/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: name, enabled: en }),
    });

    if (!response.ok) {
      // Menangkap detail error dari backend jika ada
      let errMsg = response.statusText;
      try {
        const errData = await response.json();
        if (errData.detail) errMsg = JSON.stringify(errData.detail);
      } catch (e) {}
      throw new Error(`Error ${response.status}: ${errMsg}`);
    }

    if (docs[name]) docs[name].enabled = en;
    updateStats();
    renderDocs();
  } catch (err) {
    console.error("Detail Toggle Error:", err);
    alert(`Toggle gagal. ${err.message}`);
    fetchDocs(); // Refresh untuk mengembalikan tombol seperti semula
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
