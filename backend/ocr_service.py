from google.cloud import vision
print("OCR SERVICE LOADED")
client = vision.ImageAnnotatorClient() 
# Handles communication with the google cloud vision api using credentials

def extract_text(image_bytes): # Takes in an image as bytes
    image = vision.Image(content=image_bytes) # wraps bytes into image object

    response = client.document_text_detection(image=image) #calls api to do ocr(detect text in image)

    if response.error.message:
        raise Exception(response.error.message)

    return response.full_text_annotation.text