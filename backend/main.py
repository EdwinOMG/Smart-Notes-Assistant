
from dotenv import load_dotenv
import os

# load environment variables from .env
load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ocr_service import extract_text


app = FastAPI() # create fastapi app

#cors middlewar, allowing frontend to send request to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# makes a post api endpoint at /ocr
@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    contents = await file.read() # reads raw bytes of uploaded image
    text = extract_text(contents) # calls ocr service to convert bytes to text
    return {"text": text}