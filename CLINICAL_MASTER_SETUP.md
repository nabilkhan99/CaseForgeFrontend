# Clinical Master Frontend - Setup Guide

## Overview

The Clinical Master frontend is a voice-enabled clinical consultation simulator built with Next.js. It integrates with the FastAPI backend to provide real-time voice interactions with AI patients.

## Project Structure

```
CaseForgeFrontend/
├── app/clinical-master/               # Clinical Master routes
│   ├── layout.tsx                     # Dark theme layout
│   ├── page.tsx                       # Station selection
│   ├── station/[stationId]/page.tsx   # Reading phase
│   ├── session/[sessionId]/page.tsx   # Live consultation
│   └── feedback/[sessionId]/page.tsx  # Feedback display
├── components/clinical-master/        # Reusable components
│   ├── ClinicalLayout.tsx             # Three-panel layout
│   ├── StationSidebar.tsx             # Left sidebar
│   ├── Notepad.tsx                    # Rich text notepad
│   ├── ConsultationTimer.tsx          # Countdown timer
│   ├── AudioWaveform.tsx              # Animated waveform
│   ├── TranscriptFeed.tsx             # Chat transcript
│   └── FeedbackCard.tsx               # Domain score card
├── hooks/
│   └── useAudioSession.ts             # WebSocket + audio hook
└── lib/clinical-master/
    ├── types.ts                       # TypeScript interfaces
    └── mock-data.ts                   # Mock stations/cases
```

## Setup Instructions

### 1. Install Dependencies

Make sure you have Node.js installed, then:

```bash
cd CaseForgeFrontend
npm install
```

### 2. Configure Backend URL

Create or update `.env.local` with your backend URL:

```env
NEXT_PUBLIC_CLINICAL_MASTER_URL=ws://localhost:8001
```

For production, use your deployed backend URL (e.g., `wss://your-backend.azurewebsites.net`).

### 3. Start the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### 4. Navigate to Clinical Master

Go to http://localhost:3000/clinical-master to access the simulation interface.

## User Flow

### 1. Station Selection
- Navigate to `/clinical-master`
- Select a station from the sidebar
- Click "Start Station" to begin

### 2. Reading Phase
- Read the candidate brief (patient information)
- Take notes in the notepad (auto-saved)
- 3-minute timer counts down
- Click "Enter Room" to start consultation

### 3. Live Consultation
- WebSocket connects to backend
- Audio is captured from microphone (24kHz PCM16)
- Real-time transcript displays in chat format
- Audio waveform visualizes conversation
- 2-minute timer (configurable in backend)
- Click "End Consultation" or wait for timer

### 4. Processing
- Brief loading screen while feedback generates
- Shows progress of analysis steps

### 5. Feedback Display
- Domain scores (Data Gathering, Clinical Management, Interpersonal)
- Pass/Fail determination
- Case successes and remediation points
- Key learning points
- Options to retry or proceed to next station

## Features

### Audio Handling
- **Microphone Capture**: 24kHz PCM16 mono audio
- **Real-time Streaming**: Audio sent via WebSocket as int16 arrays
- **Audio Playback**: Base64-encoded audio from backend is decoded and played

### WebSocket Events
The frontend handles these message types from the backend:
- `session_started` - Consultation begins
- `audio` - Audio response from AI
- `history_added` - New transcript item
- `consultation_ended` - Timer expired
- `feedback_ready` - Feedback available
- `error` - Error occurred

### Design System
- **Theme**: Dark navy/slate (#070A13, #161e2b)
- **Primary Color**: Indigo (#6366f1)
- **Glass Cards**: Translucent panels with blur
- **Typography**: Inter font family
- **Icons**: Material Symbols Outlined

## Backend Integration

The frontend expects the FastAPI backend to be running with these endpoints:
- `ws://backend:8001/ws/{sessionId}` - WebSocket for live consultation
- `http://backend:8001/feedback/{sessionId}` - GET feedback results

Make sure the backend is running before starting a consultation:

```bash
cd CaseForgeAzure/clinical_master
python server.py
```

## Browser Requirements

- Modern browser with WebSocket support
- Microphone access permission
- Audio playback capability
- Recommended: Chrome/Edge for best WebRTC support

## Troubleshooting

### Audio Not Working
1. Check browser permissions for microphone
2. Verify WebSocket connection in console
3. Check backend logs for errors
4. Try refreshing the page

### WebSocket Connection Failed
1. Verify backend is running on correct port
2. Check NEXT_PUBLIC_CLINICAL_MASTER_URL in .env.local
3. Check CORS settings in backend
4. Verify network connectivity

### No Feedback Displayed
1. Check backend logs for feedback generation errors
2. Verify transcript was captured during consultation
3. Try waiting longer (feedback generation takes time)
4. Check browser console for fetch errors

## Development Notes

### Mock Data
The app includes mock data for testing without a backend:
- Mock exams with 7 stations
- Sample candidate brief for Station 1
- Mock feedback with realistic scores

### State Management
- Notepad content saved to localStorage
- Session state managed in useAudioSession hook
- Transcript buffered in component state

### Future Enhancements
- Real-time dashboard with station library
- Full authentication integration
- Performance analytics graphs
- Multiple patient cases per station
- Audio recording/playback review

## Links to Existing App

The Clinical Master routes are separate from the existing CaseForge functionality:
- `/` - Original CaseForge (portfolio review)
- `/clinical-master` - Clinical Master simulation

Both apps coexist without interference.
