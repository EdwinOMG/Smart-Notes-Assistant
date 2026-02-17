#config file for ocr doc structure detection rules

class OCRConfig:
    
   
    
    
    
    
    #Bullet point detection rules    
    # Patterns that identify bullet points
    BULLET_PATTERNS = [
        r'^[•\-\*\+]\s+',             # •, -, *, + bullets
        r'^\d+\.\s+',                 # numbered list
        r'^[a-z]\)\s+',               # lettered list
        r'^[ivxIVX]+\.\s+',           # roman numeral list
        r'^\([a-z]\)\s+',             #  (a) (b) (c)
        r'^\(\d+\)\s+',               # (1) (2) (3)
        r'^○\s+',                     # circle bullets
        r'^◦\s+',                     # small circle bullets
        r'^▪\s+',                     # Square bullets
        r'^→\s+',                     # Arrow bullets
    ]
    
    
    # table detection rules
    
    # Minimum number of columns to consider as a table
    MIN_TABLE_COLUMNS = 3
    
    # Characters that commonly appear in tables (delimiters)
    TABLE_DELIMITERS = ['|', '/', '\\', '\t']
    
    # If a row has this percentage of numeric content, likely a table
    TABLE_NUMERIC_THRESHOLD = 0.3  # 30% of words contain numbers
    
    
    #key-value pair detection rules    
    # Maximum words in a key (before the colon)
    MAX_KEY_WORDS = 4
    
    # Minimum words in a value (after the colon)
    MIN_VALUE_WORDS = 1
    
    # Common key prefixes that indicate key-value pairs
    KEY_PREFIXES = [
        'name', 'date', 'author', 'title', 'subject',
        'email', 'phone', 'address', 'location',
        'price', 'cost', 'total', 'amount',
        'status', 'type', 'category', 'description',
    ]
    
    
    #  Paragraph detection rules
    
    # Minimum words to be considered a paragraph (avoid treating single lines as paragraphs)
    MIN_PARAGRAPH_WORDS = 5
    
    # Minimum characters in a paragraph
    MIN_PARAGRAPH_CHARS = 20
    
    
    # Section detection rules
    
    # Treat consecutive lines under a header as belonging to that section
    SECTION_GROUPING_ENABLED = True
    
    # Maximum gap (in lines) between content items in the same section
    MAX_SECTION_GAP = 2
    
    
    # Text clean up rules
    
    # Remove these common OCR artifacts
    OCR_ARTIFACTS = [
        '\x00',  # Null characters
        '\ufeff',  # Byte order mark
    ]
    
    # Strip these from line beginnings/ends
    STRIP_CHARS = ' \t\n\r'
    
    
    # Advanced Options
    
    # Use font size information when available
    USE_FONT_SIZE_DETECTION = True
    
    # Use spatial position information (top of page = likely header)
    USE_SPATIAL_DETECTION = True
    
    # Confidence threshold for Google Vision API (0.0 to 1.0)
    MIN_CONFIDENCE = 0.5
    
    # Enable debug logging
    DEBUG_MODE = True


# custom config for academic papers
class AcademicPaperConfig(OCRConfig):
    
   
    
    
    KEY_PREFIXES = OCRConfig.KEY_PREFIXES + [
        'doi', 'issn', 'journal', 'volume', 'issue',
        'keywords', 'citations', 'funding',
    ]


# custom configuration for meeting notes
class MeetingNotesConfig(OCRConfig):
    
    
    
    BULLET_PATTERNS = OCRConfig.BULLET_PATTERNS + [
        r'^\[ \]\s+',  # [ ] checkbox
        r'^\[x\]\s+',  # [x] checked box
        r'^TODO:\s+',  # TODO: items
        r'^Action:\s+',  # Action: items
    ]
    
    MIN_TABLE_COLUMNS = 2  # Meeting notes may have simpler tables


# custom configuration for lecture notes
class LectureNotesConfig(OCRConfig):
    
    
    
    BULLET_PATTERNS = OCRConfig.BULLET_PATTERNS + [
        r'^\*\*\s+',  # ** for emphasis
        r'^⭐\s+',  # Star for important points
        r'^!\s+',  # ! for important notes
    ]


# Default configuration to use
DEFAULT_CONFIG = OCRConfig
