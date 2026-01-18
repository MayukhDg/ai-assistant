# AI Voice Receptionist

A 24/7 AI-powered voice receptionist for SMBs (dentists, clinics, salons, consultants) that:

- ✅ Answers inbound phone calls
- ✅ Understands intent (book / reschedule / cancel / ask questions)
- ✅ Checks availability in real-time
- ✅ Creates and updates appointments
- ✅ Sends SMS/email confirmations
- ✅ Hands off to humans when needed

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Caller ──► Twilio ──► Next.js API ──► OpenAI ──► Supabase       │
│               │              │             │          │           │
│               │              │             │          ▼           │
│               │              │             │    [Appointments]    │
│               │              │             │    [Calls Log]       │
│               │              │             │    [Customers]       │
│               │              │                                    │
│               │              └───────► TwiML Response ◄──────────│
│               │                                                   │
│               └──────────────────────────────────────────────────│
│                                                                   │
│  [OPTIONAL: Real-time Streaming]                                 │
│  Caller ──► Twilio Media Stream ──► WebSocket Server ──► OpenAI  │
│                                      (Railway/Fly.io)   Realtime │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: OpenAI GPT-4o + Realtime API
- **Telephony**: Twilio Voice + Media Streams
- **Deployment**: Vercel (Next.js) + Railway/Fly.io (WebSocket Server)

## Project Structure

```
aiassistant/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   └── voice/          # Twilio webhooks
│   │   │       ├── incoming/   # Handle incoming calls
│   │   │       ├── gather/     # Process speech input
│   │   │       └── status/     # Call status updates
│   │   ├── dashboard/          # Protected admin dashboard
│   │   │   ├── appointments/
│   │   │   ├── calls/
│   │   │   ├── services/
│   │   │   └── settings/
│   │   ├── login/
│   │   ├── signup/
│   │   └── page.js             # Landing page
│   ├── components/
│   │   └── dashboard/
│   └── lib/
│       ├── supabase/           # Supabase clients
│       └── services/           # Business logic
│           ├── ai.js           # OpenAI integration
│           ├── booking.js      # Appointment logic
│           └── twilio.js       # Twilio helpers
├── websocket-server/           # Real-time voice server
│   ├── src/
│   │   ├── server.js
│   │   └── handlers/
│   │       ├── mediaStreamHandler.js
│   │       └── realtimeHandler.js
│   ├── Dockerfile
│   └── package.json
├── supabase/
│   └── schema.sql              # Database schema
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account
- Twilio account
- OpenAI API key

### 1. Clone and Install

```bash
git clone <your-repo>
cd aiassistant
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project
2. Go to SQL Editor and run the contents of `supabase/schema.sql`
3. Copy your project URL and keys to `.env.local`

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Fill in your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Set Up Twilio

1. Buy a phone number in Twilio Console
2. Configure the Voice webhook:
   - **Webhook URL**: `https://your-app.vercel.app/api/voice/incoming`
   - **Method**: POST
   - **Status Callback**: `https://your-app.vercel.app/api/voice/status`

## Deployment

### Deploy Next.js to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel dashboard.

### Deploy WebSocket Server to Railway

1. Connect your repo to Railway
2. Set the root directory to `websocket-server`
3. Add environment variables
4. Deploy

Update `VOICE_SERVER_URL` in Vercel with your Railway URL.

## Voice Flow Options

### Option 1: Webhook-Based (Simpler, works with Vercel)

Set `USE_REALTIME_STREAM=false`

- Uses Twilio's `<Gather>` for speech-to-text
- Slightly higher latency (~2-3 seconds)
- Works entirely on Vercel

### Option 2: Real-Time Streaming (Low Latency)

Set `USE_REALTIME_STREAM=true`

- Uses Twilio Media Streams + OpenAI Realtime API
- Sub-second latency
- Requires separate WebSocket server (Railway/Fly.io)

## API Reference

### Twilio Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voice/incoming` | POST | Entry point for calls |
| `/api/voice/gather` | POST | Process speech input |
| `/api/voice/status` | POST | Call status updates |

### AI Tools

The AI has access to these functions:

- `check_availability(date)` - Check open slots
- `book_appointment(name, phone, date, time)` - Book a slot
- `cancel_appointment(phone, date)` - Cancel booking
- `transfer_to_human(reason)` - Transfer to staff

## Database Schema

Key tables:

- `businesses` - Tenant configuration
- `appointments` - Scheduled bookings
- `calls` - Call logs and transcripts
- `customers` - Caller information
- `services` - Available services

See `supabase/schema.sql` for full schema.

## License

MIT

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
