# NusaGemma: Offline Agentic AI for Rural Health Clinics

> **🏆 Submission for Google MedGemma Impact Challenge**
>
> **Tracks:** Main Track & Edge AI Prize

**NusaGemma** is an offline-first, privacy-focused Clinical Decision Support System (CDSS) designed for Indonesia's 3T regions (Frontier, Outermost, Disadvantaged). It runs entirely on consumer-grade laptops without internet access, bridging the gap between advanced AI and remote healthcare.

---

## 🏥 The Problem: Healthcare in the Archipelago

Indonesia consists of **17,000+ islands**. While healthcare is decentralized through **Puskesmas** (Community Health Centers), doctors in remote regions face critical technology barriers:

1.  **Zero Connectivity:** Cloud-based AI is unusable in areas with unstable or zero internet.
2.  **Hardware Limits:** Rural clinics operate on basic laptops with limited RAM and no dedicated GPUs.
3.  **Dynamic Protocols:** Medical guidelines vary by region (e.g., Malaria in Papua vs. Dengue in Java).

## 💡 The Solution

We engineered **NusaGemma** to bring Google's state-of-the-art **MedGemma 1.5 4B** to the edge.

- **⚡ Instant Native Reasoning:** We custom-quantized the 8.64GB model down to a **2.32GB GGUF file**, allowing it to run instantly on standard CPUs.
- **🧠 Hierarchical Agentic RAG:** A novel "Two-Agent" workflow (Librarian + Doctor) that allows the system to read and cite local Ministry of Health (Kemenkes) PDFs without the performance penalty of traditional RAG on low-spec hardware.
- **🔒 100% Offline & Private:** No patient data ever leaves the device.

---

## 🛠️ Technical Architecture

We moved beyond standard scripts to build a robust **Microservice Architecture** optimized for reliability.

| Component     | Technology                 | Reasoning                                                               |
| :------------ | :------------------------- | :---------------------------------------------------------------------- |
| **Model**     | **Google MedGemma 1.5 4B** | SOTA open medical model.                                                |
| **Inference** | **Llama.cpp (GGUF)**       | Custom `Q4_K_M` quantization for CPU optimization.                      |
| **Backend**   | **FastAPI (Python)**       | High-performance async server handling background tasks.                |
| **Database**  | **ChromaDB (Dual Index)**  | Hierarchical storage for Document Summaries vs Content Chunks.          |
| **Frontend**  | **Vanilla JS + SSE**       | Lightweight UI with Server-Sent Events for real-time thought streaming. |

---

## 🚀 Installation & Setup

**Prerequisites:** You must use **Python 3.11**. Newer versions (3.12+) may cause compatibility issues with the inference engine.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/NusaGemma.git
cd NusaGemma
```

### 2. Install Dependencies

```bash
# Windows
py -3.11 -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3.11 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

### 3. ⬇️ Download the Custom Model (Critical)

Due to GitHub size limits, our custom quantized model is hosted externally.

1.  **File Name:** `medgemma-4b-it-Q4_K_M.gguf`
2.  **Size:** 2.32 GB
3.  **Download Link:** **[CLICK HERE TO DOWNLOAD FROM GOOGLE DRIVE](https://drive.google.com/file/d/1eRhud2UxKQBCy0Jzp2caE9zeIx4JIEVI/view?usp=drivesdk)**
4.  **Action:** Move the downloaded file into the `models/` folder.

**Final Folder Structure:**

```text
NusaGemma/
├── models/
│   └── medgemma-4b-it-Q4_K_M.gguf  <-- File MUST be here
├── app/
├── data/
├── static/
...
```

---

## 🏥 Usage Guide

### 1. Start the Backend

Run the high-performance API server. It will load the GGUF model into RAM.

```bash
uvicorn app.main:app --reload
```

_Wait until you see `Application startup complete` in the terminal._

### 2. Launch the App

Open your web browser and go to:
**`http://127.0.0.1:8000/`**

### 3. Features to Test

- **Native Chat:** Ask a general medical question (_"Apa tanda bahaya demam berdarah?"_). It answers instantly using internal knowledge.
- **Agentic RAG:** Toggle "Enable RAG Context", upload a PDF, and ask a specific question about it. Watch the "Thinking Process" scan the document summaries before deep-diving.

---

## 🧠 Engineering: Custom Quantization Pipeline

To achieve "Edge AI" performance, we did not use the default model weights. We built a custom quantization pipeline using `llama.cpp` on a cloud instance to convert the weights.

- **Original Size:** 8.64 GB (`bfloat16`)
- **Target Size:** 2.32 GB (`Q4_K_M`)
- **Reduction:** ~73% smaller

**[View the Engineering Notebook (Google Colab)](https://colab.research.google.com/drive/1oJdJM-4A9B3fvb4tiXuW-uUh_LC6OSky?usp=sharing)**
_This notebook demonstrates the exact build process used to create the GGUF file._

---

## 📦 Distribution Strategy

For rural deployment, we package this application as a **Portable Zip**.

1.  **No Installation:** Includes embedded Python 3.11.
2.  **One-Click Run:** Doctors simply double-click `start_nusagemma.bat`.
3.  **Hardware Tested:** Successfully deployed on an **AMD Ryzen 5 Laptop with 16GB RAM (No GPU)**.

---

## 👥 Contributors

- **Alexandro Aurellino Anandito** - AI Engineer (Architecture, Quantization, RAG)
- **Eric Vincent Kho** - Product Engineer (Frontend, UI/UX, Deployment)

---

_Built with ❤️ for Indonesia._
