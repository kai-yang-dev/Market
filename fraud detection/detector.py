import os
import re
import io
import json
import zipfile
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

# OpenAI Python SDK (new style)
from openai import OpenAI
import base64

# Optional file extractors (graceful fallback)
try:
    from pypdf import PdfReader  # pip install pypdf
except Exception:
    PdfReader = None

try:
    import docx  # pip install python-docx
except Exception:
    docx = None

try:
    import rarfile
    rarfile.UNRAR_TOOL = r"C:\Program Files\WinRAR\UnRAR.exe"
except Exception:
    rarfile = None


# -----------------------------
# Config
# -----------------------------

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY")

OPENAI_MODEL_TEXT = os.getenv("OPENAI_MODEL_TEXT", "gpt-4.1-mini")
OPENAI_MODEL_VISION = os.getenv("OPENAI_MODEL_VISION", "gpt-4.1-mini")

MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "8000"))
MAX_FILE_BYTES = int(os.getenv("MAX_FILE_BYTES", str(10 * 1024 * 1024)))  # 10MB
MAX_EXTRACTED_TEXT_CHARS = int(os.getenv("MAX_EXTRACTED_TEXT_CHARS", "6000"))


# Hard-block dangerous types (you can expand)
HARD_BLOCK_EXT = {
    ".exe", ".bat", ".cmd", ".com", ".scr",
    ".js", ".vbs", ".ps1", ".msi", ".apk",
    ".dll", ".jar", ".sh", ".py"  # (optional) block scripts if you want
}


# Fast heuristics (cheap layer)
SUSPICIOUS_REGEXES = [
    r"https?://",
    r"\btelegram\b|\bt\.me\b|\btelegram\.me\b",
    r"\bwhatsapp\b|\bwa\.me\b",
    r"\bdiscord\b|\bdiscord\.gg\b",
    r"\bgmail\b|\b@\w+\.\w+\b",              # emails (rough)
    r"\bcall me\b|\btext me\b|\bemail me\b",
    r"\bphone\b|\bnumber\b|\bcontact me\b",
    r"\bwire\b|\bbank\b|\btransfer\b|\bgift card\b",
    r"\bcrypto\b|\busdt\b|\bbtc\b|\beth\b",
    r"\b0x[a-fA-F0-9]{40}\b",                # Ethereum-like address
    r"\b(tron|trx)\b",                       # optional
    r"\bseed phrase\b|\bprivate key\b",      # credential phishing
]

# A stricter phone number heuristic (still rough)
PHONE_REGEX = re.compile(r"(\+?\d[\d\-\s().]{7,}\d)")

# If you want conservative behavior:
# - If uncertain => fraud=true (per your earlier preference)
CONSERVATIVE_IF_UNCERTAIN = os.getenv("CONSERVATIVE_IF_UNCERTAIN", "true").lower() == "true"

client = OpenAI(api_key=OPENAI_API_KEY)
app = FastAPI(title="Fraud Detector Service", version="1.0.0")

# -----------------------------
# Models
# -----------------------------

class TextCheckIn(BaseModel):
    message: str
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow your test HTML
    allow_credentials=True,
    allow_methods=["*"],   # allows OPTIONS, POST, etc.
    allow_headers=["*"],
)


@dataclass
class Decision:
    fraud: bool
    category: Optional[str] = None
    reason: Optional[str] = None
    confidence: Optional[str] = None  # "low|medium|high"
    signals: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fraud": self.fraud,
            "category": self.category,
            "reason": self.reason,
            "confidence": self.confidence,
            "signals": self.signals or [],
        }


# -----------------------------
# Utilities
# -----------------------------

def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def clamp_text(s: str, limit: int) -> str:
    if len(s) <= limit:
        return s
    return s[:limit] + "…"

def looks_like_phone(text: str) -> bool:
    return bool(PHONE_REGEX.search(text))

def quick_signals_from_text(text: str) -> List[str]:
    lower = text.lower()
    signals = []
    for pat in SUSPICIOUS_REGEXES:
        if re.search(pat, lower, flags=re.IGNORECASE):
            signals.append(f"regex:{pat}")
    if looks_like_phone(text):
        signals.append("phone_number_like")
    return signals

def extract_text_from_pdf(data: bytes) -> str:
    if not PdfReader:
        return ""
    reader = PdfReader(io.BytesIO(data))
    return "\n".join(p.extract_text() or "" for p in reader.pages)


def extract_text_from_docx(data: bytes) -> str:
    if not docx:
        return ""
    f = io.BytesIO(data)
    d = docx.Document(f)
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())


def extract_text_from_file(data: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith((".txt", ".csv", ".log")):
        return data.decode("utf-8", errors="ignore")
    if name.endswith(".pdf"):
        return extract_text_from_pdf(data)
    if name.endswith(".docx"):
        return extract_text_from_docx(data)
    return ""


def extract_archive(data: bytes, filename: str, depth: int = 0, max_depth: int = 3) -> List[str]:
    if depth > max_depth:
        return []

    texts = []
    name = filename.lower()

    def process_inner(inner_name: str, inner_data: bytes):
        ext = Path(inner_name).suffix.lower()

        # HARD BLOCK binaries anywhere
        if ext in HARD_BLOCK_EXT:
            raise ValueError(f"Blocked file inside archive: {inner_name}")

        # Recurse into nested archives
        if ext in (".zip", ".rar"):
            texts.extend(
                extract_archive(
                    inner_data,
                    inner_name,
                    depth + 1,
                    max_depth,
                )
            )
            return

        # Extract readable text
        text = extract_text_from_file(inner_data, inner_name)
        if text.strip():
            texts.append(f"[ARCHIVE:{inner_name}]\n{text}")

    if name.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for info in z.infolist():
                if not info.is_dir():
                    process_inner(info.filename, z.read(info))
    elif name.endswith(".rar") and not rarfile:
        return Decision(
            fraud=True,
            category="unsupported_archive",
            reason="RAR files are not supported on this system",
            confidence="low",
            signals=["rar_tool_missing"],
        )
    elif name.endswith(".rar") and rarfile:
        with rarfile.RarFile(io.BytesIO(data)) as r:
            for info in r.infolist():
                if not info.isdir():
                    process_inner(info.filename, r.read(info))

    return texts


# -----------------------------
# OpenAI prompts (put criteria here)
# -----------------------------

def build_system_prompt() -> str:
    # You will replace/expand these criteria once you send your real fraud criteria.
    return """
You are a fraud detection engine for a real-time chat platform.

Fraud criteria:
1. Attempts to move conversation off-platform (Telegram, WhatsApp, Discord, email, phone).
2. Sharing or requesting contact information (email, phone number, handles, usernames).
3. Requests for money, crypto, gift cards, wire transfers, wallet addresses or payment instructions.
4. Discussion about communicating outside of this platform.

Rules:
- Be strict.
- Return ONLY valid JSON.
- Do not include extra keys.

Output format (exact):
{"fraud": true|false, "category": "string or null", "reason": "short string or null", "confidence": "low|medium|high"}
""".strip()

def openai_classify(normalized_content: str) -> Decision:
    system_prompt = build_system_prompt()

    resp = client.chat.completions.create(
        model=OPENAI_MODEL_TEXT,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analyze this content:\n{clamp_text(normalized_content, MAX_TEXT_CHARS)}"},
        ],
    )
    text = (resp.choices[0].message.content or "").strip()
    try:
        obj = json.loads(text)
        fraud = bool(obj.get("fraud", False))
        category = obj.get("category", None)
        reason = obj.get("reason", None)
        confidence = obj.get("confidence", None)
        if confidence not in ("low", "medium", "high"):
            confidence = "low" if CONSERVATIVE_IF_UNCERTAIN else "medium"
        return Decision(fraud=fraud, category=category, reason=reason, confidence=confidence, signals=[])
    except Exception:
        # If model output is malformed: fail closed (optional)
        if CONSERVATIVE_IF_UNCERTAIN:
            return Decision(True, "uncertain", "Unable to validate content safely.", "low", ["json_parse_failed"])
        return Decision(False, None, None, "low", ["json_parse_failed"])

def openai_describe_image(image_bytes: bytes) -> str:
    # Convert image to "inspectable text" using vision
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    image_url = f"data:image/png;base64,{image_b64}"

    resp = client.chat.completions.create(
        model=OPENAI_MODEL_VISION,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract any text, usernames, links, contact info, "
                            "payment requests, QR codes, or scam intent visible in this image. "
                            "Return plain text only."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        },
                    },
                ],
            }
        ]
    )
    return (resp.choices[0].message.content or "").strip()


# -----------------------------
# Core decision logic
# -----------------------------

def decide_text(message: str) -> Decision:
    OFF_PLATFORM_KEYWORDS = ("telegram", "whatsapp", "discord", "t.me", "wa.me")
    msg = (message or "").strip()
    if not msg:
        return Decision(False, None, None, "high", ["empty_message"])

    msg = clamp_text(msg, MAX_TEXT_CHARS)
    signals = quick_signals_from_text(msg)

    # # If nothing suspicious, allow immediately
    # if not signals:
    #     return Decision(False, None, None, "high", ["no_signals"])

    # If very strong signals, you can optionally hard-block without OpenAI
    # HARD BLOCK: off-platform redirection (no AI)
    if any(k in msg.lower() for k in OFF_PLATFORM_KEYWORDS):
        return Decision(
            fraud=True,
            category="off_platform_redirect",
            reason="Off-platform contact request detected.",
            confidence="high",
            signals=signals
        )

    # Otherwise, ask OpenAI to confirm
    normalized = f"Content type: TEXT\nMessage:\n{msg}\nSignals:\n" + "\n".join(signals)
    d = openai_classify(normalized)
    d.signals = signals
    return d

def decide_image(image_bytes: bytes) -> Decision:
    if not image_bytes:
        return Decision(False, None, None, "high", ["empty_image"])

    # 1) Describe/extract signals via vision
    desc = openai_describe_image(image_bytes)

    # 2) Fast scan on extracted description
    signals = quick_signals_from_text(desc)

    # If nothing suspicious in description, allow
    if not signals and len(desc) < 20:
        return Decision(False, None, None, "medium", ["image_no_text_detected"])

    if not signals:
        # Still might contain scam intent without keywords, so we can do a lightweight classify
        normalized = f"Content type: IMAGE\nExtracted description:\n{desc}"
        d = openai_classify(normalized)
        d.signals = ["vision_extracted"]
        return d

    normalized = f"Content type: IMAGE\nExtracted description:\n{desc}\nSignals:\n" + "\n".join(signals)
    d = openai_classify(normalized)
    d.signals = ["vision_extracted"] + signals
    return d

def decide_file(filename: str, data: bytes) -> Decision:
    ext = Path(filename).suffix.lower()

    # Hard block dangerous standalone files
    if ext in HARD_BLOCK_EXT:
        return Decision(
            fraud=True,
            category="malicious_file",
            reason="Blocked file type",
            confidence="high",
            signals=["blocked_ext"],
        )

    texts: List[str] = []

    try:
        if ext in (".zip", ".rar"):
            texts.extend(extract_archive(data, filename))
        else:
            text = extract_text_from_file(data, filename)
            if text.strip():
                texts.append(text)

    except ValueError as e:
        return Decision(
            fraud=True,
            category="malicious_archive",
            reason=str(e),
            confidence="high",
            signals=["blocked_inside_archive"],
        )

    # No readable content
    if not texts:
        return Decision(
            fraud=CONSERVATIVE_IF_UNCERTAIN,
            category="opaque_file",
            reason="No readable content inside file",
            confidence="low",
            signals=["no_text"],
        )

    combined = "\n\n".join(texts)[:MAX_EXTRACTED_TEXT_CHARS]

    # Pre-checks (NO OpenAI)
    signals = quick_signals_from_text(combined)
    if "off_platform" in signals:
        return Decision(
            fraud=True,
            category="archive_off_platform",
            reason="Off-platform contact found inside archive",
            confidence="high",
            signals=signals,
        )
    if "phone" in signals:
        return Decision(
            fraud=True,
            category="archive_contact_info",
            reason="Phone number found inside archive",
            confidence="high",
            signals=signals,
        )
    if "crypto" in signals:
        return Decision(
            fraud=True,
            category="archive_crypto_request",
            reason="Crypto/payment request found inside archive",
            confidence="high",
            signals=signals,
        )

    # Semantic confirmation
    return openai_classify(
        f"Content type: ARCHIVE\nFilename: {filename}\n\n{combined}"
    )


# -----------------------------
# API Endpoints
# -----------------------------

@app.post("/check/text")
def check_text(payload: TextCheckIn):
    d = decide_text(payload.message)
    return d.to_dict()

@app.post("/check/image")
async def check_image(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Not an image.")
    data = await image.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large.")
    d = decide_image(data)
    return d.to_dict()

@app.post("/check/file")
async def check_file(file: UploadFile = File(...)):
    # 1️⃣ Basic validation
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    # 2️⃣ Read file bytes into memory
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    # 3️⃣ Call your fraud decision logic
    decision = decide_file(file.filename, data)

    # 4️⃣ Return normalized response
    return decision

@app.get("/health")
def health():
    return {"ok": True}
