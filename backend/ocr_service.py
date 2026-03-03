from google import genai
import os, json, re

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

LAYOUT_PROMPT = """
Analyze this handwritten note image and return ONLY a valid JSON object describing both the content AND the physical layout.

The JSON must have a "elements" array where each element represents a distinct visual region on the page.

Each element must have:
- "id": unique number starting from 1
- "type": one of ["header", "paragraph", "bullet_list", "key_value", "diagram", "table", "label"]
- "content": the transcribed text (or diagram description)
- "container": one of ["box", "underlined", "circled", "arrow", "none"] - the visual style around this element
- "position": object with:
    - "region": rough location e.g. "top-left", "top-right", "top-center", "middle-left", "middle-right", "middle-center", "bottom-left", "bottom-right", "bottom-center"
    - "x_percent": left edge as % of page width (0-100)
    - "y_percent": top edge as % of page height (0-100)
    - "width_percent": width as % of page width (0-100)
    - "height_percent": height as % of page height (0-100)
- "style": object with:
    - "is_bold": true/false (heavier strokes than surrounding text)
    - "is_large": true/false (larger than surrounding text)
    - "is_underlined": true/false
- "children": for bullet lists, array of bullet strings. Empty array otherwise.
- "connected_to": array of element ids this element points to via arrows. Empty array otherwise.

Also include at the top level:
- "page_layout": one of ["single_column", "two_column", "mixed"] 
- "raw_text": full verbatim transcription in reading order

Rules:
- Estimate positions as best you can from the image
- If a box contains a header + content, make them separate elements with the same region
- Arrows between elements should be captured in connected_to
- Return ONLY the JSON, no markdown, no explanation
"""

PROMPTS = {
    "default": LAYOUT_PROMPT,
    "lecture": LAYOUT_PROMPT + """
\nExtra instructions for lecture notes:
- Pay special attention to equations — transcribe them exactly
- Labeled diagrams should capture every label and arrow
- Defined terms should be type "key_value"
""",
    "meeting": LAYOUT_PROMPT + """
\nExtra instructions for meeting notes:
- Checkboxes: prefix content with [x] or [ ] 
- Action items should be type "bullet_list"
- Capture any names next to action items in content
"""
}


def extract_structured_text(image_bytes: bytes, note_type: str = "default") -> dict:
    import imghdr
    mime = "image/png" if imghdr.what(None, h=image_bytes) == "png" else "image/jpeg"

    prompt = PROMPTS.get(note_type, PROMPTS["default"])

    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=[
            prompt,
            {"inline_data": {"mime_type": mime, "data": image_bytes}}
        ]
    )

    raw = response.text.strip()

    # Strip markdown fences if model ignores instructions
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