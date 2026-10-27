# LinguaBridge — Universal AI Translator (starter project)

A modern web app prototype with:
- Speech-to-text using the browser Web Speech API (browser/language support varies).
- Text translation through a small FastAPI backend using `deep-translator`'s Google Translate adapter.
- Text-to-speech using the browser Speech Synthesis API.
- Webcam hand-landmark demo using MediaPipe Tasks Vision, with explicit warnings that generic hand poses are **not** ISL translation.

## Important ISL limitation
This project does **not** claim to translate Indian Sign Language. Reliable ISL translation needs a validated dataset/model covering handshape, movement, location, orientation, facial expression, and grammar. The camera panel is a hand-tracking prototype only. It displays landmarks and basic generic pose labels for interaction testing; those labels are not ISL signs and must not be presented as sign-language output.

## Requirements
- Python 3.10+
- Internet connection for installing packages, translation requests, and MediaPipe CDN assets.
- A modern browser. Speech recognition is best supported in Chromium-based browsers; support and available speech languages vary.
- Camera access for the hand-tracking demo; use `localhost` or HTTPS.

## Run on Windows
1. Extract this ZIP.
2. Open Command Prompt/PowerShell in the `universal_ai_translator` folder.
3. Create and activate a virtual environment:
   ```powershell
   py -m venv .venv
   .venv\Scripts\activate
   ```
4. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
5. Start the server:
   ```powershell
   uvicorn app:app --reload
   ```
6. Open http://127.0.0.1:8000

## Run on macOS/Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```
Then open http://127.0.0.1:8000.

## Use
1. Select the spoken/source language and target language.
2. Click **Start listening**, speak, then click **Stop**. You can edit the recognized text.
3. Click **Translate**. Translation needs an internet connection and can fail due to upstream service limits or network issues.
4. Click the speaker button to read the translation aloud.
5. Open **Sign lab** and allow camera access to test hand tracking. It is only a technical demo, not an ISL translator.

## Project layout
- `app.py` — FastAPI backend and translation endpoint.
- `requirements.txt` — Python dependencies.
- `static/index.html` — app UI.
- `static/styles.css` — responsive styling.
- `static/app.js` — speech, translation, speech synthesis, and webcam hand-landmark demo.

## Production recommendations
- Use a reputable translation/speech provider with an API key stored only on the server.
- Add rate limits, privacy notices, error monitoring, and user consent before sending text/audio to third-party services.
- Do not use the prototype for medical, legal, emergency, or other high-stakes communication.
- To add real ISL: partner with fluent ISL signers/Deaf community members, collect consented and diverse video data, annotate sign sequences and non-manual features, train/evaluate a temporal model, report measured performance, and have community experts validate outputs.
