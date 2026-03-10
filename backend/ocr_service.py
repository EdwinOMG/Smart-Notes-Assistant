import os
import json
import re

from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def detect_image_type(image_bytes: bytes) -> str:
    """Detect image type from bytes without imghdr."""
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif image_bytes[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "image/webp"
    else:
        return "image/jpeg"  # Default fallback


LAYOUT_PROMPT = """
Analyze this handwritten note image and return ONLY a valid JSON object describing both the content AND the physical layout.

The JSON must have an "elements" array where each element represents a distinct visual region on the page.

Each element must have:
- "id": unique number starting from 1
- "type": one of ["header", "paragraph", "bullet_list", "key_value", "diagram", "table", "label"]
- "content": the transcribed text (or diagram description if type is diagram)
- "container": one of ["box", "underlined", "circled", "arrow", "none"]
    - "box" = a rectangular border is drawn AROUND this text block
    - "underlined" = the text has a line drawn underneath it
    - "circled" = a circle is drawn around this text block
    - "none" = no border around this text block
- "position": object with:
    - "region": rough location e.g. "top-left", "top-right", "top-center", "middle-left", "middle-right", "middle-center", "bottom-left", "bottom-right", "bottom-center"
    - "x_percent": left edge as % of page width (0-100)
    - "y_percent": top edge as % of page height (0-100)
    - "width_percent": width as % of page width (0-100)
    - "height_percent": height as % of page height (0-100)
- "style": object with:
    - "is_bold": true/false
    - "is_large": true/false
    - "is_underlined": true/false
- "children": for bullet_list, array of bullet strings. Empty array otherwise.
- "connected_to": array of element ids this element points to via arrows. Empty array otherwise.
- "diagram": ONLY include this field when type is "diagram". It must be an object with:
    - "description": plain text description of what is drawn
    - "location": where on the page (e.g. "bottom-left")
    - "shape": one of ["rectangle", "circle", "triangle", "diamond", "arrow", "none"]
        - Pick the single most dominant shape in the diagram
        - Use "none" only if no clear geometric shape exists
    - "labels": list of ALL text strings found inside or directly labeling the shape

Also include at the top level:
- "page_layout": one of ["single_column", "two_column", "mixed"]
- "raw_text": full verbatim transcription in reading order

IMPORTANT rules:
- "container" refers to a border drawn around a TEXT element — not the shape of a diagram
- If there is a triangle/circle/diamond drawn as a DIAGRAM, set type to "diagram" and diagram.shape accordingly
- If a text section has a rectangle drawn around it, set container to "box" (not type "diagram")
- Do NOT set width_percent to less than 80 for elements that visually span most of the page width
- Return ONLY the JSON object, no markdown, no explanation
"""

PROMPTS = {
    "default": LAYOUT_PROMPT,
    "lecture": LAYOUT_PROMPT + """
\nExtra instructions for lecture notes:
- Transcribe equations exactly as written
- Labeled diagrams should capture every label in diagram.labels
- Defined terms should be type "key_value"
""",
    "meeting": LAYOUT_PROMPT + """
\nExtra instructions for meeting notes:
- Checkboxes: prefix content with [x] or [ ]
- Action items should be type "bullet_list"
- Capture names next to action items in content
"""
}


def extract_structured_text(image_bytes: bytes, note_type: str = "default") -> dict:
    mime = detect_image_type(image_bytes)
    prompt = PROMPTS.get(note_type, PROMPTS["default"])

    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[
            prompt,
            {"inline_data": {"mime_type": mime, "data": image_bytes}}
        ]
    )

    raw = response.text
    if not raw:
        reason = "empty response"
        try:
            reason = str(response.prompt_feedback) or reason
        except Exception:
            pass
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": "",
            "error": f"Gemini returned no response ({reason})"
        }

    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        structured = json.loads(raw)
    except json.JSONDecodeError as e:
        return {
            "elements": [],
            "page_layout": "unknown",
            "raw_text": raw,
            "error": f"JSON parse failed: {str(e)}"
        }

    structured["metadata"] = {
        "model": "gemini-2.5-flash-lite",
        "note_type": note_type,
    }

    return structured
