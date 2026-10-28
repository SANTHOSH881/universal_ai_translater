
from pathlib import Path
import html
import logging
import os

import requests
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from deep_translator import GoogleTranslator

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Universal AI Translator", version="1.1.0")
logging.basicConfig(level=logging.INFO)

# Community LibreTranslate instance; availability may vary.
LIBRETRANSLATE_URL = os.getenv(
    "LIBRETRANSLATE_URL",
    "https://translate.flossboxin.org.in/translate",
)


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    source: str = Field(default="auto", max_length=20)
    target: str = Field(default="en", max_length=20)


def translate_libre(text, source, target):
    response = requests.post(
        LIBRETRANSLATE_URL,
        json={
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
        },
        timeout=15,
    )
    response.raise_for_status()
    result = response.json().get("translatedText", "").strip()

    if not result:
        raise ValueError("LibreTranslate returned an empty translation.")

    return result


def translate_google(text, source, target):
    result = GoogleTranslator(
        source=source,
        target=target,
    ).translate(text)

    if not result:
        raise ValueError("Google returned an empty translation.")

    return result

def translate_mymemory(text, source, target):
    if source == "auto":
        raise ValueError(
            "Please select the source language instead of Auto Detect."
        )

    response = requests.get(
        "https://api.mymemory.translated.net/get",
        params={
            "q": text,
            "langpair": f"{source}|{target}",
        },
        timeout=15,
    )
    response.raise_for_status()

    data = response.json()

    if data.get("responseStatus") != 200:
        raise ValueError(
            data.get("responseDetails", "MyMemory translation failed.")
        )

    translated = html.unescape(
        data.get("responseData", {}).get("translatedText", "")
    ).strip()

    if not translated:
        raise ValueError("MyMemory returned no translation.")

    return translated

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "translation": "multiple providers configured",
    }


@app.post("/api/translate")
def translate(payload: TranslateRequest):
    text = payload.text.strip()
    source = payload.source or "auto"
    target = payload.target or "en"

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Please enter text to translate.",
        )

    if source == target:
        return {
            "translatedText": text,
            "source": source,
            "target": target,
        }

    providers = [
       ("MyMemory", translate_mymemory),
      ]

    errors = []

    for name, provider in providers:
        try:
            translated = provider(text, source, target)
            logging.info("Translation succeeded using %s", name)

            return {
                "translatedText": translated,
                "source": source,
                "target": target,
            }
        except Exception as exc:
            logging.warning("%s failed: %s", name, exc)
            errors.append(name)

    logging.error("All translation providers failed: %s", errors)

    raise HTTPException(
        status_code=502,
        detail=(
            "Translation services are temporarily unavailable. "
            "Please try again shortly."
        ),
    )


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)
