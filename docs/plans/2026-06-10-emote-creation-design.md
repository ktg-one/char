# Emote Creation UI Design

## Overview

Add a user-facing UI for creating custom emotes. Users can define emote names, trigger keywords, upload mouth-open/mouth-closed images, and optionally set a color for the LED ring.

## Architecture

### Data Flow

1. User clicks "Emotes" button → Emote Manager modal opens
2. Modal loads emotes from localStorage (config) + backend (images)
3. User fills form: name, keywords, uploads 2 images, picks color
4. Form submits → images uploaded to backend `/api/emotes/upload`
5. Emote config saved to localStorage
6. Backend `determine_emotion()` reads custom emotes from `/data/emotes.json`

### Storage

- **localStorage**: `{ name, keywords, color, imagePath }` for each emote
- **Backend**: images in `/static/images/custom/`, definitions in `/data/emotes.json`

## UI Components

### Emote Manager Modal

- Header: "Emotes" + close button
- List of emotes, each row shows:
  - Small thumbnail (mouth-closed image, ~40px)
  - Emote name
  - Keywords as subtle pills
  - Built-in: lock icon | Custom: delete icon
- "+ Add Custom Emote" button at bottom

### Add/Edit Form (inline expansion)

- Emote Name (text input)
- Keywords (comma-separated text input)
- Upload mouth-closed image (file input + preview)
- Upload mouth-open image (file input + preview)
- Optional color picker
- Save / Cancel buttons

## Behavior

- Clicking "+ Add" expands inline form below the button
- Form collapses after save or cancel
- Built-in emotes: neutral, happy, sad (cannot delete)
- Custom emotes: stored in localStorage + images on backend

## Backend Changes

### New Endpoints

- `GET /api/emotes` - List all emotes (built-in + custom)
- `POST /api/emotes` - Create new custom emote
- `DELETE /api/emotes/<name>` - Delete custom emote
- `POST /api/emotes/upload` - Upload emote images

### Updated Functions

- `determine_emotion()` - Check custom emotes first, then fall back to built-in keyword matching

## File Changes

- `static/app.js` - Add emote manager modal, form, and API integration
- `static/style.css` - Add styles for emote manager modal and form
- `templates/index.html` - Add emote button and modal HTML
- `app.py` - Add new endpoints and update `determine_emotion()`
