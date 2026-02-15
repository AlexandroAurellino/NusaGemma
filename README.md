# 🇮🇩 NusaGemma: The Offline Adaptive AI Companion for Puskesmas

![NusaGemma Banner](assets/nusagemma_logo.png)
_(Note: Ensure you have a logo or screenshot in `assets/`)_

**🏆 Submission for Google MedGemma Impact Challenge**
**Tracks:** Main Track & Edge AI Prize

---

## 🏥 The Problem: Healthcare in the Archipelago

Indonesia consists of **17,000+ islands**. While healthcare is decentralized through **Puskesmas** (Community Health Centers), three critical challenges remain in the "3T" (Frontier, Outermost, Disadvantaged) regions:

1.  **No Internet Reliability:** Cloud-based AI is useless in remote Papua or Maluku where connectivity is intermittent or non-existent.
2.  **Dynamic Protocols:** Disease patterns vary by island. A clinic in Java fights **Dengue**, while a clinic in Papua fights **Malaria**. Static medical apps cannot adapt fast enough.
3.  **Hardware Constraints:** Rural clinics rely on aging laptops with limited RAM, not high-end H100 GPU servers.

## 💡 The Solution: NusaGemma

**NusaGemma** is an **Offline-First, Human-Centered AI Microservice** designed specifically for the modest hardware found in rural clinics. It does not require internet access to operate.

We engineered a **custom-quantized version of Google's MedGemma-4B**, compressing it from 16GB down to 2.6GB, allowing it to run efficiently on a standard CPU while retaining medical reasoning capabilities.

### Key Features

- **🌍 100% Offline Edge AI:** Runs locally on consumer hardware (CPU-optimized via `llama.cpp`). No patient data ever leaves the laptop.
- **🧠 Chain-of-Thought Streaming:** Features a "Glass Box" UI that shows the AI's reasoning process in real-time (like Gemini/AI Studio), building trust with medical staff.
- **📚 Modular RAG Engine:** Doctors can "teach" the AI local protocols (e.g., _Kemenkes Stunting Guidelines_) simply by uploading a PDF. The AI cites page numbers for every answer.
- **⚡ Lightweight Microservice:** Built on **FastAPI**, allowing easy integration into existing Hospital Information Systems (SIMRS).

---

## 🛠️ Technology Stack (Edge Optimized)

We moved beyond standard deployments to build a custom quantization pipeline tailored for Indonesian infrastructure.

| Component              | Technology                 | Reasoning                                                                                         |
| :--------------------- | :------------------------- | :------------------------------------------------------------------------------------------------ |
| **Model Architecture** | **Google MedGemma 1.5 4B** | The state-of-the-art open medical model from Google Research.                                     |
| **Inference Engine**   | **Llama.cpp (GGUF)**       | Custom 4-bit quantization (`Q4_K_M`) allows the 4B model to run on 8GB RAM laptops without a GPU. |
| **Backend**            | **FastAPI (Python)**       | High-performance async server handling RAG and Inference streams.                                 |
| **Knowledge Base**     | **ChromaDB + LangChain**   | Local vector storage for persistent, offline document retrieval.                                  |
| **Frontend**           | **Vanilla JS (SSE)**       | Lightweight dashboard using Server-Sent Events for real-time token streaming.                     |

---

## 🚀 Installation & Setup

_Prerequisites: Python 3.10+ installed._

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/NusaGemma.git
cd NusaGemma
```

### 2. Install Dependencies

```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 3. ⬇️ Download the Custom Model (Crucial)

Due to GitHub size limits, our custom quantized model is hosted externally.

1.  **[CLICK HERE TO DOWNLOAD MODEL (Google Drive)](https://drive.google.com/file/d/111lOcrwUVoIBbfTSBmRiVxLL47lmbqV1/view?usp=sharing)**
2.  **Filename:** `medgemma-4b-it-Q4_K_M.gguf` (2.6 GB)
3.  **Action:** Move this file into the `models/` folder.
    - _Final Path:_ `NusaGemma/models/medgemma-4b-it-Q4_K_M.gguf`

---

## 🏥 Usage Guide

### 1. Start the Brain (Backend)

Run the high-performance API server. It will load the GGUF model into RAM.

```bash
uvicorn app.main:app --reload
```

_Wait until you see `Application startup complete` in the terminal._

### 2. Launch the Face (Frontend)

Simply open the file `static/index.html` in your web browser (Chrome/Edge). No complex `npm` build required.

### 3. Demo Flow

1.  **Upload Protocol:** Use the sidebar to upload a medical PDF (e.g., _Permenkes No 2 2020_).
2.  **Ask a Question:**
    > _"Apa definisi Stunting menurut dokumen ini?"_
3.  **Watch the Reasoning:** Click the **"🧠 Thinking Process..."** dropdown to see MedGemma analyze the text in real-time before providing the final answer.

---

## 📖 Usage Scenarios

### Scenario A: The Stunting Check (Java)

- **Context:** A Posyandu in rural Java needs to assess a child's growth.
- **Action:** The midwife uploads `Kemenkes_Stunting_Protocol.pdf`.
- **Query:** _"Anak laki-laki 12 bulan, panjang 71cm. Apakah stunting?"_
- **NusaGemma Response:** Identifies the -2SD threshold from Table 9 (Page 32) and reasons that 71cm is within the normal range, preventing a false diagnosis.

### Scenario B: The Fever Outbreak (Papua)

- **Context:** A patient arrives with high fever in a Malaria-endemic zone.
- **Action:** The doctor switches the active document to `WHO_Malaria_Guidelines.pdf`.
- **Query:** _"Pasien demam tinggi dan menggigil. Apa langkah pertama?"_
- **NusaGemma Response:** Cites the specific page advising immediate Rapid Diagnostic Test (RDT) before administering antibiotics.

---

## ⚖️ Ethics & Safety

- **Human-in-the-Loop:** NusaGemma is a _Clinical Decision Support System (CDSS)_. It does not replace the doctor.
- **Hallucination Prevention:** The system is engineered to refuse answering if the data is not found in the uploaded PDF.
- **Data Privacy:** As an offline edge application, **zero patient data** is transmitted to the cloud, ensuring full compliance with Indonesian medical data privacy laws (UU Perlindungan Data Pribadi).

---

## 👥 Contributors

- **Alexandro Aurellino Anandito**
- **Eric Vincent Kho**

---

_Built with ❤️ for Indonesia._
