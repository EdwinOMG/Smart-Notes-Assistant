from google.cloud import vision
from typing import Dict, List, Any, Optional
import re
from ocr_config import DEFAULT_CONFIG, OCRConfig

print("OCR SERVICE LOADED")
client = vision.ImageAnnotatorClient()

class DocumentStructureAnalyzer:
    def __init__(self, config: OCRConfig = DEFAULT_CONFIG):
        self.config = config # initialize with a configuration


    
    #Determine if a line is a bullet point
    def is_bullet_point(self, text: str) -> bool:
        for pattern in self.config.BULLET_PATTERNS:
            if re.match(pattern, text, re.IGNORECASE):
                if self.config.DEBUG_MODE:
                    print(f"Bullet point detected: '{text}'")
                return True
        return False
    
    #determine table rows
    def is_table_row(self, words: List[str]) -> bool:
        if len(words) < self.config.MIN_TABLE_COLUMNS:
            return False
       
       #check for numbers (more common in tables)
        num_numeric = sum(1 for word in words if any(char.isdigit() for char in word))
        numeric_ratio = num_numeric / len(words)

    #check for delimiters (e.g. tabs, pipes) that often indicate table structure#
        has_delimiters = any(
            delimiter in word
            for word in words
            for delimiter in self.config.TABLE_DELIMITERS
       )

        is_table = numeric_ratio > self.config.TABLE_NUMERIC_THRESHOLD or has_delimiters
       
        if is_table and self.config.DEBUG_MODE:
           print(f"Table row detected: '{' '.join(words)}'")
        return is_table
    
    #check if text is key value pair
    def is_key_value_pair(self, text: str) -> tuple[bool, Optional[str], Optional[str]]:

        if ":" not in text:
            return False, None, None
        
        parts = text.split(":", 1)
        if len(parts) != 2:
            return False, None, None
        
        key, value = parts  
        key_stripped = key.strip()
        value_stripped = value.strip()

        # key must be short
        if len(key_stripped.split()) > self.config.MAX_KEY_WORDS:
            return (False, None, None)
        
        # value must have something in it
        if len(value_stripped.split()) < self.config.MIN_VALUE_WORDS:
            return (False, None, None)
        
        # check if key starts with common prefixes
        key_lower = key_stripped.lower()
        is_common_key = any(
            key_lower.startswith(prefix) 
            for prefix in self.config.KEY_PREFIXES
        )

        if is_common_key or len(key_stripped.split()) <= 3:
            if self.config.DEBUG_MODE:
                print(f"Key-value pair detected: {key_stripped} : {value_stripped}")
            return (True, key_stripped, value_stripped)
        
        return (False, None, None)
    
    #check if text is a paragraph by length
    def is_paragraph(self, text: str) -> bool:
        words = text.split()
        return (len(words) >= self.config.MIN_PARAGRAPH_WORDS and len(words) <= self.config.MIN_PARAGRAPH_CHARS)
    

#extract structured text from image bytes using google vision, using configurable header and section detection
def extract_structured_text(image_bytes: bytes, config: OCRConfig = DEFAULT_CONFIG) -> Dict[str, Any]:

    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)

    if response.error.message:
        raise Exception(f"Google Vision API error: {response.error.message}")
    
    full_text = response.full_text_annotation.text

    for artifact in config.OCR_ARTIFACTS: 
        full_text = full_text.replace(artifact, " ")
    
    lines = [line.strip(config.STRIP_CHARS) for line in full_text.split('\n') if line.strip()]

    # init analyzer with configurations
    analyzer = DocumentStructureAnalyzer(config)

    # get font and spatial information
    font_sizes = []
    line_positions = {}
    page_height = None

    if response.full_text_annotation.pages:
        for page in response.full_text_annotation.pages:
            if page.height:
                page_height = page.height

            #get paragraph text
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    para_text = ""
                    for word in paragraph.words:
                        word_text = ''.join([symbol.text for symbol in word.symbols])
                        para_text += word_text + " "
                    para_text = para_text.strip()

                    #store position
                    if paragraph.bounding_box.vertices:
                        y_pos = paragraph.bounding_box.vertices[0].y
                        line_positions[para_text] = y_pos

                    for word in paragraph.words:
                        vertices = word.bounding_box.vertices
                        if len(vertices) >= 3:
                            height = vertices[2].y - vertices[0].y
                            font_sizes.append(height)
    avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else None

    document_structure = {
        "headers": [],
        "sections": [],
        "key_values": [],
        "bullet_points": [],
        "tables": [],
        "paragraphs": []
    }
     
    current_section = None
    current_section_content = []
    table_buffer = []

    for i, line in enumerate(lines):
        position_y = line_positions.get(line)

        font_size = None 
        if line in line_positions and font_sizes:
            font_size = avg_font_size


        

        if analyzer.is_bullet_point(line):
            document_structure["bullet_points"].append(line)
            if config.SECTION_GROUPING_ENABLED:
                current_section_content.append({"type": "bullet", "text": line})
            continue

        is_kv, key, value = analyzer.is_key_value_pair(line)
        if is_kv and key and value:
            document_structure["key_values"][key] = value
            if config.SECTION_GROUPING_ENABLED:
                current_section_content.append({
                    "type": "key_value", 
                    "key": key, 
                    "value": value
                })
            continue

        words = line.split()
        if analyzer.is_table_row(words):
            table_buffer.append(line)
            continue
        else:
            if table_buffer:
                document_structure["tables"].append(table_buffer)
                if config.section_GROUPING_ENABLED:
                    current_section_content.append({
                        "type": "table",
                        "rows": table_buffer
                    })
                table_buffer = []
        
        if analyzer.is_paragraph(line):
            document_structure["paragraphs"].append(line)
            if config.SECTION_GROUPING_ENABLED:
                current_section_content.append({
                    "type": "paragraph",
                    "text": line
                })
        else:
            if config.SECTION_GROUPING_ENABLED:
                current_section_content.append({
                    "type": "other",
                    "text": line
                })
    if config.SECTION_GROUPING_ENABLED and current_section:
        document_structure["sections"].append({
            "title": current_section,
            "content": current_section_content
        })

    if table_buffer:
        document_structure["tables"].append(table_buffer)
        
    document_structure["metadata"] = {
        "total_lines": len(lines),
        "avg_font_size": avg_font_size,
        "page_height": page_height,
        "config_used": config.__class__.__name__
    }
    return document_structure
    