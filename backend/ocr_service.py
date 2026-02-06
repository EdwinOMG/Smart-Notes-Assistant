from google.cloud import vision
print("OCR SERVICE LOADED")
client = vision.ImageAnnotatorClient()

def extract_text(image_bytes):
    image = vision.Image(content=image_bytes)

    response = client.document_text_detection(image=image)

    if response.error.message:
        raise Exception(response.error.message)

    return response.full_text_annotation.text