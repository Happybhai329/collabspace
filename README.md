# 🚀 CollabSpace — Real-Time Collaborative Workspace

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**A production-grade Agile Project Management Tool — built in 20 days**

*Think Jira + Trello + Notion, built from scratch with a modern stack*

</div>

---

## 📋 Overview

CollabSpace is a real-time collaborative workspace for agile teams. It supports Kanban/Scrum boards, task management, team collaboration, notifications, and a full activity audit trail — all with real-time updates via Socket.io.

## ✨ Features (20-Day Build)

| Day | Feature |
|-----|---------|
| ✅ Day 1 | System architecture, MongoDB schemas, JWT authentication, security |
| 🔨 Day 2 | Workspace & User management APIs |
| 🔨 Day 3 | Project & Board management |
| 🔨 Day 4 | Task management (Kanban drag & drop) |
| 🔨 Day 5 | Real-time collaboration via Socket.io |
| 🔨 Day 6 | Comments, mentions, notifications |
| 🔨 Day 7 | Activity logs & audit trail |
| 🔨 Day 8 | File uploads, rich text editor |
| 🔨 Day 9 | Scrum sprints, backlogs |
| 🔨 Day 10 | Frontend — Auth & Dashboard |
| 🔨 Day 11-15 | Frontend — Boards, Tasks, Real-time UI |
| 🔨 Day 16-18 | Search, filters, analytics |
| 🔨 Day 19-20 | Docker, CI/CD, deployment |

---

## 🏗️ Architecture

```
Client (React + Zustand)
        │
        ├── REST API (Axios)       ──► Express.js ──► MongoDB
        └── WebSocket (Socket.io) ──► Socket.io  ──► Redis (Pub/Sub)
```

**Clean Architecture Layers:**
```
Routes → Controller → Service → Model → Database
```

- **Controllers** — thin HTTP layer only
- **Services** — all business logic, no HTTP dependencies
- **Models** — Mongoose schemas with indexes and hooks
- **Middleware** — auth, validation, error handling, rate limiting

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 20+** | Runtime (ES Modules) |
| **Express.js** | HTTP framework |
| **MongoDB + Mongoose** | Primary database |
| **Redis (ioredis)** | Session store, pub/sub, rate limiting |
| **Socket.io** | Real-time WebSocket communication |
| **JWT** | Stateless authentication (access + refresh tokens) |
| **Zod** | Runtime request validation |
| **Winston** | Structured logging (JSON in prod, colorized in dev) |
| **Helmet + CORS** | Security headers |
| **bcryptjs** | Password hashing |

### Frontend *(Coming Day 10)*
| Technology | Purpose |
|------------|---------|
| **React 18 + Vite** | UI framework |
| **Zustand** | State management |
| **React Router v6** | Client-side routing |
| **Tailwind CSS** | Styling |
| **Axios** | HTTP client |

---

## 📁 Project Structure

```
collabspace/
├── backend/
│   ├── src/
│   │   ├── config/              # DB, Redis, Logger, Env config
│   │   ├── constants/           # Roles, Enums (TASK_STATUS, PRIORITY...)
│   │   ├── middleware/          # Auth, Validation, Error Handler, Rate Limiter
│   │   ├── models/              # 10 Mongoose schemas
│   │   │   ├── User.model.js
│   │   │   ├── Workspace.model.js
│   │   │   ├── WorkspaceMember.model.js
│   │   │   ├── Project.model.js
│   │   │   ├── Board.model.js
│   │   │   ├── Column.model.js
│   │   │   ├── Task.model.js
│   │   │   ├── Comment.model.js
│   │   │   ├── Notification.model.js
│   │   │   └── ActivityLog.model.js
│   │   ├── modules/
│   │   │   └── auth/            # Routes, Controller, Service, Validation
│   │   └── utils/               # ApiResponse, ApiError, asyncWrapper
│   ├── server.js                # Entry point + graceful shutdown
│   ├── .env.example             # Environment variable template
│   └── Dockerfile               # Multi-stage production build
└── frontend/                    # Coming Day 10
```

---

## 🔐 Database Schema Design

10 MongoDB collections with carefully designed indexes:

| Collection | Key Design Decision |
|-----------|-------------------|
| `users` | `select: false` on password; bcrypt in pre-save hook |
| `workspaces` | URL-safe slugs; denormalized `memberCount` |
| `workspace_members` | Compound unique index `{workspace, user}` |
| `projects` | Jira-style key (e.g. `MOBILE`); atomic `taskCounter` |
| `boards` | `columnOrder: [ObjectId]` for O(1) drag-and-drop writes |
| `columns` | `taskOrder: [ObjectId]`; WIP limits; status mapping |
| `tasks` | Self-referential subtasks; virtual `identifier` (PROJ-42) |
| `comments` | Soft delete; edit history; emoji reactions; @mentions |
| `notifications` | TTL index auto-expires read notifications after 30 days |
| `activity_logs` | Immutable audit trail; field-level change tracking |

---

## 🔒 Security Features

- **Helmet** — 14 HTTP security headers (CSP, HSTS, X-Frame-Options...)
- **CORS** — Origin allowlist with credentials support
- **Rate Limiting** — 3 tiers: global (100/15min), auth (10/15min), sensitive (5/hr)
- **NoSQL Injection** — `express-mongo-sanitize` strips `$` operators from inputs
- **HTTP Parameter Pollution** — `hpp` middleware
- **JWT** — HS256, short-lived (15min) access + long-lived (7d) refresh with rotation
- **Refresh Token** — bcrypt-hashed in MongoDB; stolen DB ≠ stolen sessions
- **Token Revocation** — Redis blocklist for instant logout (no 15min window)
- **httpOnly Cookies** — Refresh tokens inaccessible to JavaScript (XSS-safe)
- **Password Policy** — Min 8 chars, requires uppercase + lowercase + number + special char

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- Redis (local or Upstash)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Happybhai329/collabspace.git
cd collabspace/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Redis config, and JWT secrets

# Start development server
npm run dev
```

### Available Endpoints (Day 1)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | Public | Server health check |
| `POST` | `/api/v1/auth/register` | Public | Create account |
| `POST` | `/api/v1/auth/login` | Public | Login |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh access token |
| `POST` | `/api/v1/auth/logout` | 🔒 JWT | Logout + revoke token |
| `GET` | `/api/v1/auth/me` | 🔒 JWT | Get my profile |

### API Response Format

All endpoints return a consistent envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged in successfully.",
  "data": {
    "user": { "id": "...", "firstName": "John", "email": "john@example.com" },
    "accessToken": "eyJhbGci..."
  }
}
```

---

## 🐳 Docker

```bash
cd backend
docker build -t collabspace-api .
docker run -p 5000:5000 --env-file .env collabspace-api
```

---

## 📝 API Response Examples

**Register / Login:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "password": "Secret@123",
    "confirmPassword": "Secret@123"
  }'
```

**Validation Error:**
```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed.",
  "errors": [
    { "field": "password", "message": "Password must contain at least one uppercase letter..." }
  ]
}
```

---

## 👥 Role System

| Role | Level | Capabilities |
|------|-------|-------------|
| **Owner** | 5 | Full control, can delete workspace |
| **Admin** | 4 | Manage all resources and members |
| **Manager** | 3 | Create/manage projects and assign tasks |
| **Developer** | 2 | Create and complete assigned tasks |
| **Viewer** | 1 | Read-only access |

---

## 📅 Progress

This project is being built incrementally over 20 days following production engineering practices:
- Clean architecture (Controller → Service → Model)
- SOLID principles
- Zero placeholder code
- Production-ready security
- Comprehensive error handling
- Scalable database design

---

<div align="center">

**Built with ❤️ over 20 days**

</div>
