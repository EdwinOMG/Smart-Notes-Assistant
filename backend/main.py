
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()


from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ocr_service import extract_text


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    contents = await file.read()
    text = extract_text(contents)
    return {"text": text}