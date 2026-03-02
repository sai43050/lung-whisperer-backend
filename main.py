from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import torch
import numpy as np
import shutil
from preprocess import preprocess_audio, extract_features
from model import LungWhispererModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classes = ["Normal", "Crackle", "Wheeze", "Asthma", "COPD"]

model = LungWhispererModel()
import os

model_path = os.path.join(os.path.dirname(__file__), "model.pth")
model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
model.eval()

@app.get("/")
def home():
    return {"message": "Lung Whisperer API Running"}

@app.post("/predict/")
async def predict(file: UploadFile = File(...)):
    file_location = "temp.wav"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    signal = preprocess_audio(file_location)
    features = extract_features(signal)
    features = np.expand_dims(features, axis=0)
    features = np.expand_dims(features, axis=0)
    tensor = torch.tensor(features, dtype=torch.float32)
    with torch.no_grad():
        outputs = model(tensor)
        probabilities = torch.softmax(outputs, dim=1)
        predicted = torch.argmax(probabilities, dim=1).item()
        confidence = probabilities[0][predicted].item()
    return {
        "prediction": classes[predicted],
        "confidence": round(confidence*100,2)
    }
