# CivicVision

CivicVision is a crowd-sourced, geo-tagged platform designed for accountable civic management. The application serves as an intelligent assistant for reporting community infrastructure and municipal issues—such as potholes, sanitation problems, and broken streetlights—utilizing advanced AI to process, analyze, and categorize civic reports automatically.

## 🚀 Features

* **AI-Powered Report Analysis:** Integrates **Google Generative AI** to analyze uploaded imagery and streamline the categorization and severity assessment of civic amenity issues.
* **Geo-Tagged Reporting:** Utilizes a **Location API** to capture precise device coordinates, ensuring infrastructure problems are accurately mapped for municipal authorities.
* **Automated Email Notifications:** Integrates **Nodemailer** to send real-time email updates, alerts, and confirmations regarding the status of submitted complaints.
* **Interactive Dashboard:** Seamless frontend-backend communication to track, manage, and update civic reports.

## 💻 Tech Stack

* **Frontend:** React Native, Location API
* **Backend:** Node.js, Express, Prisma ORM, Nodemailer
* **Artificial Intelligence:** Google Generative AI (`@google/generative-ai`)

## 🛠️ Getting Started

### Prerequisites

Make sure you have Node.js and npm installed on your machine.

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Bharath-K04/CivicVision.git](https://github.com/Bharath-K04/CivicVision.git)
Backend Setup:
Navigate to the backend directory and install dependencies:

Bash
cd backend
npm install
Configure Environment Variables:
Create a .env file in the backend folder and add your environment variables, including your Google Generative AI API key, Location API key, and Nodemailer email credentials:

Code snippet
PORT=5000
DATABASE_URL="your-database-connection-string"
GEMINI_API_KEY="your-google-generative-ai-key"
LOCATION_API_KEY="your-location-api-key"
EMAIL_USER="your-email@example.com"
EMAIL_PASS="your-email-app-password"
Run Database Migrations and Start Server:

Bash
npx prisma migrate dev
npm run dev
Frontend Setup:
Open a new terminal, navigate to the frontend directory, and install dependencies:

Bash
cd frontend
npm install
Start the Application:

Bash
npx expo start
👤 Author
K Bharath

📄 License
This project is licensed under the MIT License.   
