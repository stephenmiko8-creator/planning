# 📅 Planix

Planix is a modern, secure, multi-tenant SaaS application that provides intelligent scheduling, automatic calendar organization, and context-aware planning.

The project is split into three main parts:
- **`backend/`**: A Node.js & Express API using SQLite for data persistence, the Google Calendar API for calendar synchronization, and the Gemini API for smart scheduling context and parsing.
- **`frontend/`**: A React + Vite web dashboard built with a premium neon-dark theme, interactive planning grids, and plan subscription/quota tools.
- **`extension/`**: A Chrome extension to capture scanning events or assist with local planning.

---

## 🛠️ Environment Prerequisites

Make sure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [npm](https://www.npmjs.com/) (normally bundled with Node.js)
- A modern web browser (e.g., Google Chrome)

---

## 🚀 Setting Up the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install the backend dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables. Copy the `.env.example` to a new `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and supply the required API keys and client credentials:
   - **`PORT`**: The local server port (defaults to `3001`).
   - **`GEMINI_API_KEY`**: Your Gemini API key for smart schedule generation.
   - **`GOOGLE_CLIENT_ID`** & **`GOOGLE_CLIENT_SECRET`**: Obtained from your Google Cloud Console project configured with the Google Calendar API.
   - **`GOOGLE_REDIRECT_URI`**: The callback URL configured in Google OAuth credentials (normally `http://localhost:3001/api/calendar/auth/google/callback`).
   - **`TIMEZONE`**: Your default timezone (e.g., `Europe/Paris`).

5. Run the backend server in development mode (with hot reloading via `nodemon`):
   ```bash
   npm run dev
   ```
   *Note: The SQLite database file (`planning.db`) will automatically initialize and run migration checks in `backend/database/` on the first launch.*

---

## 💻 Setting Up the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   This will start the local website on `http://localhost:5173`.

4. *(Optional)* Configure a custom API URL:
   By default, the React app targets `http://localhost:3001`. If you need to point it elsewhere, set the `VITE_API_URL` environment variable:
   - On Windows (PowerShell): `$env:VITE_API_URL="http://your-custom-backend:3001"`
   - On Linux/macOS: `VITE_API_URL=http://your-custom-backend:3001 npm run dev`

---

## 🔌 Loading the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the `extension/` directory from this repository.
5. The extension is now active and ready to communicate with your local dashboard.

---

## 🔒 Security & Data Isolation
- **Authentication**: Secured with JWT (JSON Web Tokens). Ensure requests to protected routes pass the authorization header `Bearer <token>`.
- **Database Rules**: All user data, categories, and events are strictly isolated by `user_id`.
- **Subscriptions**: Users are assigned a subscription tier (`free`, `pro`, or `premium`). Free tier users are subject to monthly scan quotas.
