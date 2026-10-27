from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from deep_translator import GoogleTranslator

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="LinguaBridge Translator", version="1.0.0")


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    source: str = Field(default="auto", max_length=20)
    target: str = Field(default="en", max_length=20)


@app.get("/api/health")
def health():
    return {"status": "ok", "translation": "online adapter; external service required"}


@app.post("/api/translate")
def translate(payload: TranslateRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please enter text to translate.")
    source = payload.source or "auto"
    target = payload.target or "en"
    try:
        translator = GoogleTranslator(source=source, target=target)
        translated = translator.translate(text)
        if not translated:
            raise ValueError("The translation service returned an empty result.")
        return {"translatedText": translated, "source": source, "target": target}
    except Exception as exc:
        # Keep provider details out of the response; they may contain implementation information.
        raise HTTPException(
            status_code=502,
            detail="Translation service unavailable. Check your internet connection and try again."
        ) from exc


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
