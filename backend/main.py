
from dotenv import load_dotenv
import os

# load environment variables from .env
load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ocr_service import extract_structured_text


app = FastAPI() # create fastapi app

#cors middleware, allowing frontend to send request to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# makes a post api endpoint at /ocr
@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    contents = await file.read()
    
    if not contents:
        return {"error": "Uploaded file is empty"}
    
    print(f"File name: {file.filename}, Content type: {file.content_type}, Size: {len(contents)} bytes")
    
    try:
        structured_data = extract_structured_text(contents)
    except Exception as e:
        return {"error": str(e)}
    print(structured_data)
    return structured_data