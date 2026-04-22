# emocare-ai

EmoCare AI is a comprehensive platform for emotional wellness and therapy. 

## Project Structure (Files Tracked on GitHub)

The repository is structured into a `backend` and a `frontend`, along with necessary scripts and configuration files for deployment. Below is the list of files pushed to GitHub:

### Root Directory
- `.gitattributes`, `.gitignore`
- `LICENSE`
- `Procfile` (Deployment config)
- `README.md` (This file)
- `railway.json`, `runtime.txt` (Deployment config)

### Backend (`/backend`)
Contains the FastAPI backend application, machine learning models, and database configurations.
- `requirements.txt`: Python dependencies.
- `.env.example`: Template for environment variables.
- `app/main.py`: Entry point for the FastAPI application.
- `app/api/routes/`: API endpoints (`admin.py`, `appointments.py`, `auth.py`, `chat.py`, `therapist.py`, `users.py`).
- `app/core/`: Core configurations and utilities (`audit.py`, `config.py`, `email.py`, `groq.py`, `security.py`).
- `app/db/`: Database models and engine (`engine.py`, `models.py`).
- `app/ml/`: Machine learning inference and RAG components (`audio_inference.py`, `fusion.py`, `model_loader.py`, `rag.py`, `shap_engine.py`, `text_inference.py`).
- `app/services/`: Core business logic services (`chat_service.py`).
- `app/websocket/`: WebSocket manager for real-time features (`manager.py`).
- `knowledge_base/`: Knowledge base files (`cbt_metadata.json`, `faiss_cbt.index`).

### Frontend (`/frontend`)
Contains the React frontend application built with Vite.
- `package.json`, `package-lock.json`: Node.js dependencies.
- `vite.config.js`, `eslint.config.js`: Tooling configuration.
- `index.html`, `public/`: Static assets and entry HTML.
- `src/App.jsx`, `src/main.jsx`: Main React application files.
- `src/api/client.js`: API client configuration.
- `src/components/`: Reusable React components (e.g., `Chat`, `Sidebar`, `AudioRecorder`, `MessageBubble`, etc.).
- `src/pages/`: Application pages (e.g., `Login`, `Register`, `Chat`, `Dashboards`, `AdminPanel`).
- `src/store/`: Zustand state management (`authStore.js`, `chatStore.js`).

### Scripts (`/scripts`)
- `build_knowledge_base.py`: Script to build the RAG knowledge base.
- `startup.sh`: Deployment startup script.


## How to Run the Project Locally

Follow these steps to set up and run the project after cloning the repository from GitHub:

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd emocare-ai
```

### 2. Backend Setup
The backend is built with Python. You need to create a virtual environment, install dependencies, and configure environment variables.

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```
2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```
3. **Activate the virtual environment:**
   - On Mac/Linux:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
4. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
5. **Set up environment variables:**
   - Copy `.env.example` to `.env` and fill in the required keys (e.g., Groq API key, database URL, etc.).
     ```bash
     cp .env.example .env
     ```
6. **Run the backend server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   The backend API will be available at `http://localhost:8000`.

### 3. Frontend Setup
The frontend is built with React and Vite. You need to install Node dependencies.

1. **Open a new terminal window** (keep the backend server running).
2. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```
3. **Install Node.js dependencies:**
   *(Ensure you have Node.js and npm installed)*
   ```bash
   npm install
   ```
4. **Run the frontend development server:**
   ```bash
   npm run dev
   ```
   The frontend application will be available at `http://localhost:5173`.
```