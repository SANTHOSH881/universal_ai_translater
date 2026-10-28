
from pathlib import Path
import html
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="LinguaBridge Translator", version="1.1.0")


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    source: str = Field(default="auto", max_length=20)
    target: str = Field(default="en", max_length=20)


def split_text(text, max_bytes=450):
    """Split text into chunks below MyMemory's request-size limit."""
    chunks = []
    current = ""

    for word in text.split():
        candidate = f"{current} {word}".strip()

        if len(candidate.encode("utf-8")) <= max_bytes:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        # Handle an unusually long word without exceeding the byte limit.
        part = ""
        for char in word:
            if len((part + char).encode("utf-8")) > max_bytes:
                chunks.append(part)
                part = char
            else:
                part += char

        current = part

    if current:
        chunks.append(current)

    return chunks


def translate_chunk(text, source, target):
 params = urlencode({
    "q": text,
    "langpair": f"{source}|{target}",
    "de": "santhoshtejavath8888@gmail.com"
})
    url = f"https://api.mymemory.translated.net/get?{params}"

    request = Request(
        url,
        headers={"User-Agent": "UniversalAITranslator/1.0"}
    )

    with urlopen(request, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))

    if data.get("responseStatus") != 200:
        message = data.get("responseDetails", "Translation provider error")
        raise ValueError(message)

    translated = data.get("responseData", {}).get("translatedText", "")
    if not translated:
        raise ValueError("The translation provider returned no text.")

    return html.unescape(translated)


@app.get("/api/health")
def health():
    return {"status": "ok", "translation": "MyMemory API"}


@app.post("/api/translate")
def translate(payload: TranslateRequest):
    text = payload.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Please enter text to translate."
        )

    source = (payload.source or "auto").strip()
    target = (payload.target or "en").strip()

    if source == target:
        return {
            "translatedText": text,
            "source": source,
            "target": target
        }

    try:
        chunks = split_text(text)
        translated_chunks = [
            translate_chunk(chunk, source, target)
            for chunk in chunks
        ]

        return {
            "translatedText": " ".join(translated_chunks),
            "source": source,
            "target": target
        }

    except (HTTPError, URLError, TimeoutError, ValueError, Exception) as exc:
        logging.exception("MyMemory translation failed")
        raise HTTPException(
            status_code=502,
            detail=(
                "Translation service unavailable. "
                "Please try again later or use a shorter message."
            )
        ) from exc


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
