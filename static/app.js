const API_URL = "http://127.0.0.1:8000";

// --- STATE ---
let currentSessionId = null;
let chatHistory = JSON.parse(localStorage.getItem("nusaChatHistory")) || [];

// --- ELEMENTS ---
const docList = document.getElementById("docList");
const chatHistoryList = document.getElementById("chatHistoryList");
const chatWindow = document.getElementById("chatWindow");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const uploadBtn = document.getElementById("uploadBtn");
const pdfInput = document.getElementById("pdfInput");

window.onload = async () => {
  checkHealth();
  loadDocuments();
  renderChatHistory();
  startNewChat(); // Start blank

  // Listeners
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener("click", sendMessage);
  uploadBtn.addEventListener("click", () => pdfInput.click());
  pdfInput.addEventListener("change", (e) => uploadPDF(e.target));
};

// --- CHAT SESSION MANAGEMENT ---

function startNewChat() {
  currentSessionId = Date.now();
  chatWindow.innerHTML = `
        <div class="message ai" id="welcomeMsg">
            <div class="ai-icon"><i class="fa-solid fa-robot"></i></div>
            <div class="ai-content">
                <div class="ai-text">
                    <strong>Selamat datang di NUSAGEMMA.</strong><br>
                    Sistem siap membantu analisis Juknis & Rekam Medis (Hierarchical Mode).
                </div>
            </div>
        </div>`;

  // Deactivate history selection
  document
    .querySelectorAll(".chat-item")
    .forEach((el) => el.classList.remove("active"));
}

function saveToHistory(role, text, thought = null, sources = null) {
  let session = chatHistory.find((s) => s.id === currentSessionId);

  // Create new session if not exists
  if (!session) {
    session = {
      id: currentSessionId,
      title: text.substring(0, 25) + (text.length > 25 ? "..." : ""),
      messages: [],
    };
    chatHistory.unshift(session); // Add to top
  } else {
    // Move to top if active
    chatHistory = chatHistory.filter((s) => s.id !== currentSessionId);
    chatHistory.unshift(session);
  }

  session.messages.push({ role, text, thought, sources });

  // Save and Render
  localStorage.setItem("nusaChatHistory", JSON.stringify(chatHistory));
  renderChatHistory();
}

function renderChatHistory() {
  chatHistoryList.innerHTML = "";
  chatHistory.forEach((session) => {
    const li = document.createElement("li");
    li.className = `chat-item ${session.id === currentSessionId ? "active" : ""}`;
    li.innerText = session.title || "New Chat";
    li.onclick = () => loadSession(session.id);

    // Add delete button for chat (optional, mini icon)
    const delSpan = document.createElement("span");
    delSpan.innerHTML = ' <i class="fa-solid fa-xmark"></i>';
    delSpan.style.float = "right";
    delSpan.style.opacity = "0.5";
    delSpan.onclick = (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    };

    li.appendChild(delSpan);
    chatHistoryList.appendChild(li);
  });
}

function loadSession(id) {
  currentSessionId = id;
  const session = chatHistory.find((s) => s.id === id);
  if (!session) return;

  chatWindow.innerHTML = ""; // Clear current view

  // Replay messages
  session.messages.forEach((msg) => {
    if (msg.role === "user") {
      appendUserMessage(msg.text, false);
    } else {
      // Reconstruct AI message structure
      const containerId = "hist-" + Math.random();
      appendAIContainer(containerId);
      const data = {
        type: "final_answer",
        content: msg.text,
        thinking: msg.thought,
        sources: msg.sources,
      };

      // Populate
      const wrapper = document.getElementById(containerId);
      if (msg.thought) {
        wrapper.querySelector(".thought-process").style.display = "block";
        wrapper.querySelector(".thought-content").innerHTML = escapeHtml(
          msg.thought,
        );
      }
      wrapper.querySelector(".ai-text").innerHTML = formatText(msg.text);

      if (msg.sources && msg.sources.length > 0) {
        const sourceBox = wrapper.querySelector(".sources-list");
        sourceBox.style.display = "block";
        sourceBox.innerHTML =
          "<strong>Sumber:</strong> " +
          msg.sources.map((s) => `<i>${escapeHtml(s)}</i>`).join(", ");
      }
    }
  });

  renderChatHistory(); // Update active state
}

function deleteSession(id) {
  chatHistory = chatHistory.filter((s) => s.id !== id);
  localStorage.setItem("nusaChatHistory", JSON.stringify(chatHistory));
  renderChatHistory();
  if (currentSessionId === id) startNewChat();
}

// --- FILE MANAGEMENT ---

async function loadDocuments() {
  try {
    const res = await fetch(`${API_URL}/documents`);
    const docs = await res.json();
    docList.innerHTML = "";

    if (Object.keys(docs).length === 0) {
      docList.innerHTML = `<li style="text-align:center; color:#666; font-size:0.8rem; padding:10px;">No files yet</li>`;
      return;
    }

    for (const [filename, info] of Object.entries(docs)) {
      const li = document.createElement("li");
      // Dynamic class based on status
      li.className = `file-item ${info.status === "processing" ? "processing" : ""} ${!info.enabled ? "disabled" : ""}`;

      // Icon logic
      let iconClass = "fa-regular fa-file-pdf";
      if (info.status === "processing")
        iconClass = "fa-solid fa-spinner fa-spin";
      if (info.status === "error")
        iconClass = "fa-solid fa-triangle-exclamation";

      li.innerHTML = `
                <div class="file-info" title="${filename}">
                    <i class="${iconClass}"></i>
                    <div class="file-name">${filename}</div>
                </div>
                <div class="file-actions">
                    <button class="action-btn btn-toggle ${info.enabled ? "active" : ""}" 
                            onclick="toggleFile('${filename}', ${info.enabled})" 
                            title="${info.enabled ? "Disable" : "Enable"}">
                        <i class="fa-solid ${info.enabled ? "fa-toggle-on" : "fa-toggle-off"}"></i>
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteFile('${filename}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
      docList.appendChild(li);
    }

    // Polling if processing
    const isProcessing = Object.values(docs).some(
      (d) => d.status === "processing",
    );
    if (isProcessing) setTimeout(loadDocuments, 3000);
  } catch (e) {
    console.error("Docs error", e);
  }
}

async function toggleFile(filename, currentState) {
  try {
    await fetch(`${API_URL}/documents/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, enabled: !currentState }),
    });
    loadDocuments();
  } catch (e) {
    alert("Toggle failed");
  }
}

async function deleteFile(filename) {
  if (!confirm(`Delete ${filename}?`)) return;
  try {
    await fetch(`${API_URL}/documents/${filename}`, { method: "DELETE" });
    loadDocuments();
  } catch (e) {
    alert("Delete failed");
  }
}

async function uploadPDF(input) {
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append("file", input.files[0]);

  // UI Immediate Feedback
  const tempItem = document.createElement("li");
  tempItem.className = "file-item processing";
  tempItem.innerHTML = `<div class="file-info"><i class="fa-solid fa-spinner fa-spin"></i> <div class="file-name">Uploading...</div></div>`;
  docList.prepend(tempItem);

  try {
    const res = await fetch(`${API_URL}/documents/upload?force=true`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      loadDocuments();
    } else {
      alert("Upload failed");
      tempItem.remove();
    }
  } catch (e) {
    alert("Error");
    tempItem.remove();
  }
  input.value = "";
}

// --- CHAT LOGIC (STREAMING) ---

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendUserMessage(text, true); // Save to history = true
  userInput.value = "";
  sendBtn.disabled = true;

  const containerId = "ai-" + Date.now();
  appendAIContainer(containerId);

  // Temp buffers for saving history later
  let fullThought = "";
  let fullAnswer = "";
  let fullSources = [];

  try {
    const response = await fetch(`${API_URL}/chat-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        use_rag: document.getElementById("useRag").checked,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        const cleanLine = line.replace("data: ", "").trim();
        if (!cleanLine || cleanLine === "[DONE]") continue;

        try {
          const data = JSON.parse(cleanLine);

          // Capture for history
          if (data.type === "thought") fullThought += data.content;
          if (data.type === "final_answer") fullAnswer += data.content;
          if (data.type === "sources") fullSources = data.content;

          updateAIResponse(containerId, data);
        } catch (err) {
          fullAnswer += cleanLine;
          updateAIResponse(containerId, {
            type: "final_answer",
            content: cleanLine,
          });
        }
      }
    }

    // Save full interaction to history
    saveToHistory("ai", fullAnswer, fullThought, fullSources);
  } catch (e) {
    updateAIResponse(containerId, {
      type: "final_answer",
      content: "⚠️ Connection Error.",
    });
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// --- UTILS ---
function appendUserMessage(text, save = false) {
  const container = chatWindow.querySelector(".container-width");
  if (!container) return; // Safety check
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
  container.appendChild(div);
  scrollToBottom();

  if (save) saveToHistory("user", text);
}

function appendAIContainer(id) {
  const container = chatWindow.querySelector(".container-width");
  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  wrapper.id = id;
  wrapper.innerHTML = `
        <div class="ai-icon"><i class="fa-solid fa-robot"></i></div>
        <div class="ai-content">
            <details class="thought-process" style="display:none">
                <summary>Thinking Process</summary>
                <div class="thought-content"></div>
            </details>
            <div class="ai-text"></div>
            <div class="sources-list" style="display:none"></div>
        </div>
    `;
  container.appendChild(wrapper);
  scrollToBottom();
}

function updateAIResponse(id, data) {
  const wrapper = document.getElementById(id);
  if (!wrapper) return;

  if (data.type === "thought") {
    wrapper.querySelector(".thought-process").style.display = "block";
    wrapper.querySelector(".thought-content").innerHTML += escapeHtml(
      data.content,
    );
  } else if (data.type === "final_answer") {
    wrapper.querySelector(".ai-text").innerHTML += formatText(data.content);
  } else if (data.type === "sources" && data.content.length) {
    const box = wrapper.querySelector(".sources-list");
    box.style.display = "block";
    box.innerHTML =
      "<strong>Sumber:</strong> " +
      data.content.map((s) => `<i>${escapeHtml(s)}</i>`).join(", ");
  }
  scrollToBottom();
}

function checkHealth() {
  fetch(`${API_URL}/health`)
    .then((res) => {
      if (res.ok) {
        statusDot.className = "status-dot online";
        statusText.innerText = "System Online";
      }
    })
    .catch(() => {
      statusDot.className = "status-dot";
      statusText.innerText = "Offline";
    });
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function escapeHtml(text) {
  return text
    ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : "";
}
function formatText(text) {
  return escapeHtml(text)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}
function openSettings() {
  alert("Settings menu placeholder");
}
