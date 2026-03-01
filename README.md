# Message API

A unified messaging API supporting **WhatsApp** (via Baileys), **Email** (SMTP), and **SMS** (Twilio / Vonage / Generic HTTP), with a professional Admin UI.

---

## Features

| Feature | Description |
|---|---|
| WhatsApp | Full Baileys integration – send/receive all message types, group management, profile operations |
| Email | SMTP via Nodemailer, configurable per-server |
| SMS | Twilio, Vonage, or any Generic HTTP provider |
| Unified API | Single `POST /api/send` endpoint for all channels |
| Session UI | Admin panel to manage WhatsApp sessions with live QR scanning |
| Config UI | Admin panel to manage Email & SMS provider settings |
| Real-time | Socket.IO for live QR code delivery & session status updates |
| Persistence | MongoDB for sessions, messages, and configuration |

---

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

---

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env – set MONGODB_URI and SESSION_SECRET at minimum

# 3. Create admin user
npm run init-admin

# 4. Start server
npm start          # production
npm run dev        # development (nodemon)
```

Open **http://localhost:3000/admin/login** → sign in → manage sessions.

---

## API Reference

### Unified Send – `POST /api/send`

```jsonc
// WhatsApp text
{ "channel": "whatsapp", "sessionId": "my-session", "to": "1234567890", "messageType": "text", "text": "Hello!" }

// WhatsApp image (base64)
{ "channel": "whatsapp", "sessionId": "my-session", "to": "1234567890", "messageType": "image", "mediaBase64": "<base64>", "caption": "Look at this" }

// Email
{ "channel": "email", "to": "user@example.com", "subject": "Hello", "text": "Hello from Message API" }

// SMS
{ "channel": "sms", "to": "+1234567890", "text": "Your OTP is 123456" }
```

### WhatsApp Sessions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/whatsapp/sessions` | List all sessions |
| POST | `/api/whatsapp/sessions` | Create & connect session |
| GET | `/api/whatsapp/sessions/:id` | Get session details |
| DELETE | `/api/whatsapp/sessions/:id` | Delete session |
| POST | `/api/whatsapp/sessions/:id/logout` | Logout session |
| POST | `/api/whatsapp/sessions/:id/reconnect` | Reconnect session |

### WhatsApp Messages

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/whatsapp/sessions/:id/messages/text` | Send text |
| POST | `/api/whatsapp/sessions/:id/messages/image` | Send image (multipart or base64) |
| POST | `/api/whatsapp/sessions/:id/messages/video` | Send video |
| POST | `/api/whatsapp/sessions/:id/messages/audio` | Send audio / PTT |
| POST | `/api/whatsapp/sessions/:id/messages/document` | Send document |
| POST | `/api/whatsapp/sessions/:id/messages/sticker` | Send sticker |
| POST | `/api/whatsapp/sessions/:id/messages/location` | Send location |
| POST | `/api/whatsapp/sessions/:id/messages/contact` | Send contact card |
| POST | `/api/whatsapp/sessions/:id/messages/reaction` | React to message |
| POST | `/api/whatsapp/sessions/:id/messages/poll` | Create poll |
| POST | `/api/whatsapp/sessions/:id/messages/reply` | Reply to message |
| PUT | `/api/whatsapp/sessions/:id/messages/:msgId` | Edit message |
| DELETE | `/api/whatsapp/sessions/:id/messages/:msgId` | Delete message |
| POST | `/api/whatsapp/sessions/:id/messages/read` | Mark as read |
| GET | `/api/whatsapp/sessions/:id/messages` | Message history (DB) |

### WhatsApp Groups, Profile, Status, Contacts

Full group management (create, add/remove/promote/demote participants, invite codes, join by invite), profile picture/status/name updates, WhatsApp Status broadcasts, contact block/unblock — all available under `/api/whatsapp/sessions/:id/`.

### Config (Admin-only)

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/config/email` | List / create email configs |
| PUT/DELETE | `/api/config/email/:id` | Update / delete |
| POST | `/api/config/email/test` | Test SMTP connection |
| GET/POST | `/api/config/sms` | List / create SMS configs |
| PUT/DELETE | `/api/config/sms/:id` | Update / delete |

### Admin Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/login` | Login |
| POST | `/api/admin/logout` | Logout |
| GET | `/api/admin/me` | Current user |
| POST | `/api/admin/change-password` | Change password |

---

## Admin UI Pages

| URL | Description |
|---|---|
| `/admin/login` | Admin login |
| `/admin/sessions` | Manage WhatsApp sessions (add, QR scan, reconnect, delete) |
| `/admin/config` | Email & SMS provider configuration |
| `/admin/change-password` | Update admin password |
| `/sessions` | Public session status overview |

---

## SMS Providers

### Twilio
Set `provider: twilio`, `apiUsername: <AccountSID>`, `apiPassword: <AuthToken>`, `from: <Twilio number>`

### Vonage (Nexmo)
Set `provider: vonage`, `apiUsername: <API Key>`, `apiPassword: <API Secret>`, `from: <Sender ID>`

### Generic HTTP
Set `provider: generic_http`, `apiUrl: <POST endpoint>`. The API will POST `{ to, from, message, username?, password?, api_key? }`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Express session secret |
| `ADMIN_USERNAME` | Default admin username |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash (set via `npm run init-admin`) |
| `EMAIL_*` | Default SMTP settings (overridable via UI) |
| `SMS_*` | Default SMS settings (overridable via UI) |
