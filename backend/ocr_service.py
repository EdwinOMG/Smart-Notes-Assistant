from google.cloud import vision

print("OCR SERVICE LOADED")
client = vision.ImageAnnotatorClient()

# function to extract structured text from image bytes using Google Cloud Vision API
def extract_structured_text(image_bytes):
    image = vision.Image(content=image_bytes) # get bytes of image
    response = client.document_text_detection(image=image) #wraps bytes into image object

    if response.error.message:
        raise Exception(response.error.message)

    full_text = response.full_text_annotation.text # get full text from response
    lines = [line.strip() for line in full_text.split('\n') if line.strip()] #split text into lines

    key_values = {}
    table_rows = []
    # key-value pairs are lines containing a colon :, lines with 3 or more words are table rows (GONNA CHANGE IN FUTURE)
    for line in lines:
        if ':' in line:
            key, value = line.split(':', 1)
            key_values[key.strip()] = value.strip()
        else:
            words = line.split()
            if len(words) >= 3:
                table_rows.append(words)

    return {
        "key_values": key_values,
        "table_rows": table_rows
    }