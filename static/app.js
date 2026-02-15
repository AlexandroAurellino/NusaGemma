// --- CONFIGURATION ---
const API_URL = "http://127.0.0.1:8000"; // Ensure this matches your FastAPI port

// --- DOM ELEMENTS ---
const docList = document.getElementById("docList");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatWindow = document.getElementById("chatWindow");
const uploadBtn = document.getElementById("uploadBtn");
const pdfInput = document.getElementById("pdfInput");

// --- INITIALIZATION ---
window.onload = async () => {
    // 1. Check Backend Connection
    checkHealth();
    
    // 2. Load Existing PDFs
    loadDocuments();

    // 3. Setup Event Listeners
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    sendBtn.addEventListener("click", sendMessage);

    uploadBtn.addEventListener("click", () => {
        pdfInput.click();
    });

    pdfInput.addEventListener("change", (e) => {
        uploadPDF(e.target);
    });
};

// --- API FUNCTIONS ---

async function checkHealth() {
    try {
        const res = await fetch(`${API_URL}/`);
        if (res.ok) {
            statusDot.className = "status-dot online";
            statusText.innerText = "System Online";
        }
    } catch (e) {
        statusDot.className = "status-dot";
        statusText.innerText = "Offline";
        setTimeout(checkHealth, 5000); // Retry every 5s if offline
    }
}

async function loadDocuments() {
    try {
        const res = await fetch(`${API_URL}/documents`);
        const docs = await res.json();
        
        docList.innerHTML = "";
        
        // Handle array response ["a.pdf", "b.pdf"]
        // Or object response {"a.pdf": {...}}
        const entries = Array.isArray(docs) ? docs : Object.keys(docs);

        if (entries.length === 0) {
            docList.innerHTML = `<li style="padding:10px; color:#666; font-size:0.8rem; text-align:center;">Belum ada dokumen</li>`;
            return;
        }

        entries.forEach(filename => {
            const li = document.createElement("li");
            li.className = "file-item active";
            // Clean up filename length for display
            const shortName = filename.length > 25 ? filename.substring(0, 22) + "..." : filename;
            li.innerHTML = `<i class="fa-regular fa-file-pdf"></i> ${shortName}`;
            docList.appendChild(li);
        });
    } catch (e) {
        console.error("Failed to load docs", e);
    }
}

async function uploadPDF(input) {
    if (!input.files[0]) return;

    // UI Feedback
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", input.files[0]);

    try {
        const res = await fetch(`${API_URL}/documents/upload?force=true`, {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            await loadDocuments();
            alert("Upload Berhasil!");
        } else {
            const err = await res.json();
            alert("Upload Gagal: " + (err.detail || "Unknown Error"));
        }
    } catch (e) {
        alert("Error connecting to server.");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        input.value = ""; // Reset file input
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 1. Show User Message
    appendUserMessage(text);
    userInput.value = "";
    sendBtn.disabled = true;

    // 2. Prepare AI Bubble (with loading state)
    const containerId = "ai-" + Date.now();
    appendAIContainer(containerId);

    try {
        // 3. Start Streaming Request
        const response = await fetch(`${API_URL}/chat-stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                use_rag: document.getElementById("useRag").checked
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // SSE lines usually come as "data: {...}"
            // We split by double newline to get chunks
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // Keep the last partial chunk

            for (const line of lines) {
                const cleanLine = line.replace("data: ", "").trim();
                if (!cleanLine || cleanLine === "[DONE]") continue;

                try {
                    const data = JSON.parse(cleanLine);
                    updateAIResponse(containerId, data);
                } catch (err) {
                    // Fallback: If backend sends plain text, just append it
                    updateAIResponse(containerId, { type: 'final_answer', content: cleanLine });
                }
            }
        }

    } catch (e) {
        console.error(e);
        updateAIResponse(containerId, { type: 'final_answer', content: "⚠️ Maaf, terjadi kesalahan koneksi ke AI." });
    } finally {
        sendBtn.disabled = false;
        // Keep focus for fast typing
        userInput.focus();
    }
}

// --- UI HELPERS ---

function appendUserMessage(text) {
    const container = chatWindow.querySelector(".container-width");
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    scrollToBottom();
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

    const thoughtBox = wrapper.querySelector(".thought-process");
    const thoughtContent = wrapper.querySelector(".thought-content");
    const textBox = wrapper.querySelector(".ai-text");
    const sourceBox = wrapper.querySelector(".sources-list");

    // 1. Thinking / Thoughts
    if (data.type === "thought" || data.thinking) {
        thoughtBox.style.display = "block";
        const txt = data.content || data.thinking;
        thoughtContent.innerHTML += escapeHtml(txt);
    } 
    // 2. Final Answer
    else if (data.type === "final_answer" || data.response || data.answer) {
        const raw = data.content || data.response || data.answer || "";
        textBox.innerHTML += formatText(raw);
    } 
    // 3. Sources (RAG)
    else if (data.type === "sources" || data.sources) {
        const srcs = data.content || data.sources;
        if (srcs && srcs.length > 0) {
            sourceBox.style.display = "block";
            sourceBox.innerHTML = "<strong>Sumber:</strong> " + srcs.map(s => `<i>${escapeHtml(s)}</i>`).join(", ");
        }
    }

    scrollToBottom();
}

function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Basic Security & Formatting
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatText(text) {
    // Converts newlines to <br> and **bold** to <strong>
    return escapeHtml(text)
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}