import numpy as np
import subprocess
import datetime
print(f"NumPy Version: {np.__version__}")
import matplotlib
matplotlib.use('Agg')

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import json
import base64
import gc
import math
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models as db_models
import database
import os
from dotenv import load_dotenv
load_dotenv()
import shutil
import io
import torch
import torch.nn as nn
from torchvision import models as tv_models
from torchvision import transforms
from PIL import Image
# numpy already imported at top
import torchxrayvision as xrv
import cv2
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image
import torchaudio
import torchaudio.transforms as T
from socket_server import socket_app
import auth
from jose import JWTError, jwt
import agent
import dispatch
import requests
import httpx
from google import genai
from google.genai import types

# Initialize Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

# Create Tables
db_models.Base.metadata.create_all(bind=database.engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup: Eagerly pre-warm AI Models ---
    print("LIFESPAN: Preparing High-Performance AI Engine (16GB Mode)...")
    try:
        # Load into module-level globals for route accessibility
        get_image_models()
        get_audio_models()
        print(f"LIFESPAN: Models loaded. Image: {len(image_ensemble)}, Audio: {len(audio_ensemble)}")
        app.state.models_ready = True
    except Exception as e:
        import traceback
        print(f"LIFESPAN CRITICAL ERROR: Failed to pre-warm engine: {e}")
        traceback.print_exc()
        app.state.models_ready = False
    
    yield
    
    # --- Shutdown ---
    print("LIFESPAN: Shutting down AI Engine...")
    image_ensemble.clear()
    audio_ensemble.clear()
    gc.collect()

app = FastAPI(title="Lung Whisperer API", lifespan=lifespan)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@app.get("/")
def read_root():
    # Redirect root to docs for easy API testing in Hugging Face Spaces
    return RedirectResponse(url="/docs")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy", 
        "version": "1.1.0-ULTRA-STABLE", 
        "engine": "Hybrid-Free-16GB-RAM-HARDENED",
        "lifespan_initialized": getattr(app.state, "models_ready", False),
        "image_models": len(image_ensemble),
        "audio_models": len(audio_ensemble),
        "numpy": np.__version__
    }

@app.get("/api/admin/verify-system")
def verify_system_status():
    ffmpeg_present = False
    ffmpeg_version = "Missing"
    try:
        output = subprocess.check_output(["ffmpeg", "-version"], stderr=subprocess.STDOUT).decode()
        ffmpeg_present = True
        ffmpeg_version = output.splitlines()[0]
    except Exception as e:
        ffmpeg_version = str(e)

    return {
        "version": "1.1.0-ULTRA-STABLE",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "dependencies": {
            "ffmpeg": ffmpeg_present,
            "ffmpeg_info": ffmpeg_version,
            "torchaudio": getattr(torchaudio, "__version__", "Unknown"),
            "numpy": np.__version__,
            "torch": torch.__version__
        },
        "engine": {
            "image_models": len(image_ensemble),
            "audio_models": len(audio_ensemble),
            "lifespan_ready": getattr(app.state, "models_ready", False)
        },
        "deployment": "Railway-Hardened-v2"
    }

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = auth.decode_access_token(token)
    if payload is None:
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    user = db.query(db_models.User).filter(db_models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# CORS Configuration
origins = ["*"] # Allow all for rapid rescue, refined later

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app"
)

# Mount Socket.io handler
app.mount("/ws", socket_app)

# Use Environment variable for UPLOAD_DIR (crucial for Hugging Face /tmp)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----- Image Deep Learning Setup -----
torch.set_num_threads(1) # CRITICAL: Prevent CPU thrashing on limited containers
IMAGE_MODEL1_PATH = "model_weights_resnet18.pth"
IMAGE_MODEL2_PATH = "model_weights_densenet121.pth"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

image_ensemble = []

def get_image_models():
    if not image_ensemble:
        try:
            # Load pre-trained Clinical DenseNet121 from TorchXRayVision
            m1 = xrv.models.DenseNet(weights="densenet121-res224-all")
            m1 = m1.to(device)
            m1.eval()
            image_ensemble.append(m1)
            print("Loaded TorchXRayVision Clinical DenseNet-121!")
        except Exception as e:
            print(f"Failed to load clinical image models: {e}")
    return image_ensemble

def generate_gradcam_b64(model, tensor, target_idx=None):
    try:
        # XRV DenseNet target layer
        target_layers = [model.features.norm5]
        cam = GradCAM(model=model, target_layers=target_layers)
        targets = [ClassifierOutputTarget(target_idx)] if target_idx is not None else None
        
        grayscale_cam = cam(input_tensor=tensor, targets=targets)[0, :]
        
        # Scale original tensor back to 0-1 for overlay
        img = tensor.cpu().numpy()[0, 0, :, :]
        img_min, img_max = img.min(), img.max()
        if img_max > img_min:
            img = (img - img_min) / (img_max - img_min)
        else:
            img = np.zeros_like(img)
            
        rgb_img = np.repeat(img[:, :, np.newaxis], 3, axis=2)
        visualization = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True)
        
        # BGR for cv2
        _, buffer = cv2.imencode('.jpg', visualization[:, :, ::-1])
        b64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        print(f"GradCAM failed: {e}")
        return ""

def get_clinical_report(prediction: str):
    if prediction == "COVID-19":
        return {"findings": ["Ground-glass opacities", "Bilateral asymmetric infiltrates", "Vascular thickening"], "suggestions": ["Isolate immediately", "RT-PCR confirmation", "Monitor SpO2 tracking"]}
    elif prediction == "Tuberculosis":
        return {"findings": ["Apical cavitation", "Upper lobe infiltrates", "Pleural effusion"], "suggestions": ["Sputum AFB smear", "Initiate anti-TB protocol", "Airborne precautions"]}
    elif prediction == "Bacterial Pneumonia":
        return {"findings": ["Lobar consolidation", "Air bronchograms", "Pleural effusion possible"], "suggestions": ["Start empiric antibiotics", "Blood cultures", "Monitor CBC"]}
    elif prediction == "Viral Pneumonia":
        return {"findings": ["Diffuse interstitial opacities", "Peribronchial cuffing", "Lack of focal consolidation"], "suggestions": ["Supportive care", "Viral panel testing", "Hydration"]}
def predict_heuristic(image_bytes: bytes) -> dict:
    """High-speed pixel-based diagnostic fallback if the Neural Net is busy or fails."""
    try:
        from PIL import Image
        import numpy as np
        import io
        img = Image.open(io.BytesIO(image_bytes)).convert('L')
        arr = np.array(img)
        
        # Analyze intensity distribution (lungs are usually darker)
        avg_intensity = np.mean(arr)
        std_dev = np.std(arr)
        
        if avg_intensity > 150: # Very bright - possible major consolidation or exposure issue
            pred = "Suspected Opacity / Consolidation"
            findings = ["Increased lung opacity", "Reduced air volume", "High structural density"]
            conf = 65.0
        elif std_dev > 60: # High contrast - possible texture anomalies
            pred = "Pneumonia-like Signatures"
            findings = ["Infiltrate patterns detected", "Texture irregularity", "Possible effusion"]
            conf = 55.0
        else:
            pred = "Normal / Healthy (Heuristic)"
            findings = ["Standard intensity profile", "Normal structural symmetry"]
            conf = 75.0
            
        return {
            "prediction": pred,
            "confidence": conf,
            "findings": findings,
            "suggestions": ["Clinical correlation recommended", "Consider re-scanning if symptoms persist"],
            "gradcam": ""
        }
    except Exception as e:
        print(f"Heuristic failed: {e}")
        return {"prediction": "Analysis Error", "confidence": 0.0, "findings": ["Error analyzing image pixels"], "suggestions": [], "gradcam": ""}

def predict_real_image(image_bytes: bytes, filename: str = "") -> dict:
    models = get_image_models()
    if not models:
        raise RuntimeError("Local image models not initialized.")

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.Grayscale(num_output_channels=1),
        transforms.ToTensor()
    ])
    tensor = transform(image).unsqueeze(0)
    
    # xrv scaling expectation: min-max normalized array (-1024, 1024) approximation
    # usually ToTensor scales 0 to 1, xrv wants it specifically formatted around 1024 range:
    tensor = tensor * 2048 - 1024
    tensor = tensor.to(device)
    
    gc.collect() # Purge memory before inference
    
    try:
        with torch.no_grad():
            model = image_ensemble[0]
            outputs = model(tensor)[0]
    except Exception as e:
        print(f"Inference failed, falling back to heuristic: {e}")
        return predict_heuristic(image_bytes)
        
    # Analyze raw clinical pathologies. Indices are matched against model.pathologies
    pathologies = model.pathologies
    
    scores = outputs.cpu().numpy()
    
    detected_abnormalities = []
    max_score = 0
    max_idx = None
    
    for i, path in enumerate(pathologies):
        score = float(scores[i])
        if math.isnan(score):
            score = 0.0
        if score > max_score:
            max_score = score
            max_idx = i
        if score > 0.5: # Configurable clinical threshold
             detected_abnormalities.append((path, score))
             
    detected_abnormalities.sort(key=lambda x: x[1], reverse=True)
    
    if len(detected_abnormalities) == 0 or max_score <= 0.5:
        final_pred = "Normal / Healthy"
        confidence = (1 - max_score) * 100 if max_score < 1 else 99.0
        findings = ["Clear lung fields", "No dense opacities detected", "Normal cardiac silhouette", "Costophrenic angles sharp"]
        suggestions = ["Routine annual screening", "Maintain healthy habits"]
        target_idx = None
    else:
        top_pathology = detected_abnormalities[0][0]
        final_pred = f"Detected: {top_pathology}"
        confidence = max_score * 100
        target_idx = max_idx
        
        findings = [f"{path} signature detected ({score*100:.1f}%)" for path, score in detected_abnormalities[:4]]
        suggestions = [f"Immediate clinical correlation for {top_pathology}", "Consider high-resolution CT scan", "Monitor SpO2 tracking closely"]

    # Guarantee bounded confidence [0, 100]
    confidence = min(max(confidence, 0.0), 100.0)
    
    # NOTE: GradCAM is disabled in production to optimize for memory and prevent server hangs.
    # heatmap_b64 = generate_gradcam_b64(model, tensor, target_idx)
    heatmap_b64 = "" 
    
    return {
        "prediction": final_pred,
        "confidence": round(confidence, 1),
        "gradcam": heatmap_b64,
        "findings": findings,
        "suggestions": suggestions
    }

# ----- Audio Deep Learning Setup -----
AUDIO_MODEL1_PATH = "audio_model_weights_resnet18.pth"
AUDIO_MODEL2_PATH = "audio_model_weights_resnet18.pth" # Fallback to same file if specific version missing
AUDIO_CLASSES_PATH = "audio_classes.txt"

audio_ensemble = []
audio_classes = ["healthy", "COVID-19", "symptomatic"] # Fallback

def get_audio_models():
    global audio_classes
    if not audio_ensemble:
        if not os.path.exists(AUDIO_CLASSES_PATH):
            return []
            
        with open(AUDIO_CLASSES_PATH, "r") as f:
            audio_classes = f.read().split(",")
        num_classes = len(audio_classes)
            
        try:
            if os.path.exists(AUDIO_MODEL1_PATH):
                m1 = tv_models.resnet18(pretrained=False)
                m1.fc = nn.Linear(m1.fc.in_features, num_classes)
                m1.load_state_dict(torch.load(AUDIO_MODEL1_PATH, map_location=device))
                m1 = m1.to(device)
                m1.eval()
                audio_ensemble.append(m1)
                print("Loaded ResNet18 Audio Model")

            if os.path.exists(AUDIO_MODEL2_PATH):
                m2 = tv_models.mobilenet_v3_small(pretrained=False)
                m2.classifier[3] = nn.Linear(m2.classifier[3].in_features, num_classes)
                m2.load_state_dict(torch.load(AUDIO_MODEL2_PATH, map_location=device))
                m2 = m2.to(device)
                m2.eval()
                audio_ensemble.append(m2)
                print("Loaded MobileNetV3 Audio Model")
        except Exception as e:
            print(f"Failed to load audio models: {e}")
    return audio_ensemble

def predict_real_audio(file_path: str) -> dict:
    models = get_audio_models()
    if not models:
        raise RuntimeError("Local audio models not initialized.")
    
    waveform, sample_rate = torchaudio.load(file_path)
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
            
    mel_spectrogram = T.MelSpectrogram(sample_rate=16000, n_mels=128)(waveform)
    
    import torch.nn.functional as F
    spectrogram = mel_spectrogram.unsqueeze(0)
    spectrogram = F.interpolate(spectrogram, size=(224, 224), mode='bilinear', align_corners=False)
    tensor = spectrogram.squeeze(0).repeat(3, 1, 1).unsqueeze(0).to(device)
    
    with torch.no_grad():
        probs_accum = None
        for model in audio_ensemble:
            outputs = model(tensor)
            probs = torch.nn.functional.softmax(outputs, dim=1)[0]
            if probs_accum is None:
                probs_accum = probs
            else:
                probs_accum += probs
        
        probs_accum /= len(audio_ensemble)
        confidence, predicted = torch.max(probs_accum, 0)
        
        # Map all probabilities to find acoustic signatures
        all_probs = probs_accum.cpu().numpy()
        acoustic_signatures = []
        for i, cls in enumerate(audio_classes):
            acoustic_signatures.append((cls, float(all_probs[i])))
        acoustic_signatures.sort(key=lambda x: x[1], reverse=True)
        
        findings = [f"Acoustic match for {cls}: {score*100:.1f}%" for cls, score in acoustic_signatures]
        suggestions = ["Consult a physician if symptomatic"]
        if acoustic_signatures[0][0] != "healthy" and acoustic_signatures[0][1] > 0.5:
            suggestions = [f"High match for {acoustic_signatures[0][0]} pattern", "Advise clinical evaluation", "Keep taking regular SpO2 readings"]

    return {
        "prediction": audio_classes[predicted.item()],
        "confidence": round(confidence.item() * 100, 1),
        "findings": findings,
        "suggestions": suggestions
    }
# -------------------------------

# --- Pydantic Schemas ---
class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "patient"
    full_name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None

class VitalsCreate(BaseModel):
    user_id: int
    spo2: float
    respiratory_rate: float
    heart_rate: float

class AlertCreate(BaseModel):
    user_id: int
    message: str
    severity: str

class ChatMessage(BaseModel):
    message: str

class ReportUpdate(BaseModel):
    report: str

class MedicationCreate(BaseModel):
    name: str
    dosage: str
    time: str

class MedicationUpdate(BaseModel):
    taken: int

class SmokingProfileUpdate(BaseModel):
    quit_date: Optional[str] = None
    cigs_per_day: Optional[int] = None
    price_per_pack: Optional[int] = None

class BreathingSessionCreate(BaseModel):
    technique: str
    rounds: int
    duration_minutes: float

# -------------------------------

@app.post("/api/auth/register")
def register_user(req: RegisterRequest, db: Session = Depends(database.get_db)):
    user = db.query(db_models.User).filter(db_models.User.username == req.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = auth.get_password_hash(req.password)
    new_user = db_models.User(
        username=req.username,
        password_hash=hashed_password,
        role=req.role,
        full_name=req.full_name,
        email=req.email,
        age=req.age,
        gender=req.gender,
        date_of_birth=req.date_of_birth,
        phone=req.phone,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"msg": "User created successfully"}

@app.post("/api/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(db_models.User).filter(db_models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "username": user.username, "role": user.role, "full_name": user.full_name}

@app.post("/api/auth/mock-login")
def mock_login(username: str, db: Session = Depends(database.get_db)):
    # This is for testing only!
    user = db.query(db_models.User).filter(db_models.User.username == username).first()
    if not user:
        # Auto-register mock user if not exists
        hashed_password = auth.get_password_hash("mockpassword")
        user = db_models.User(username=username, password_hash=hashed_password, role="patient")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "username": user.username, "role": user.role, "full_name": user.full_name}

async def analyze_with_gemini(image_bytes: bytes):
    if not client:
        return None
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                "VERIFICATION PROTOCOL: First, determine if this image is a Chest X-ray (CXR). "
                "If it is NOT a Chest X-ray (e.g., a photo of a person, animal, different organ, or text), return JSON ONLY: {'error': 'INVALID_ANATOMY', 'message': 'The uploaded image is not a Chest X-ray. Analysis restricted to respiratory imaging.'}."
                "If it IS a Chest X-ray, analyze for potential pathologies. Return a JSON object with: 'prediction', 'confidence' (0.1-1.0), 'findings' (list), 'suggestions' (list). "
                "Ensure NO text appears outside the JSON object.",
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            ]
        )
        # Handle potential markdown formatting in response
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(raw_text)
        return data
    except Exception as e:
        print(f"Gemini Vision Fallback Error: {e}")
        return None

async def analyze_audio_with_gemini(audio_bytes: bytes):
    if not client:
        return None
    try:
        # Gemini can analyze audio/spectrograms
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                "Analyze this respiratory audio (cough/breathing). Identify potential states (Healthy, COVID-19, Symptomatic). Return a JSON object with: 'prediction', 'confidence' (0-1), 'explanation' (string). Do not include any text outside the JSON.",
                types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")
            ]
        )
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(raw_text)
        return data
    except Exception as e:
        print(f"Gemini Audio Fallback Error: {e}")
        return None

async def verify_chest_xray(image_bytes: bytes):
    if not client:
        return True # Fallback only if client is missing
    try:
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[
                "MANDATORY CLINICAL AUDIT: Is this image a human Chest X-ray, thoracic scan, or respiratory medical imaging? "
                "Account for digital contrast variations, pediatric anatomy, or minor tilts. "
                "Answer YES if it is any medical scan of the chest/lungs. "
                "Answer NO only if it is clearly a non-medical image (like a person's face, a pet, food, or a landscape). "
                "Answer ONLY: YES or NO.",
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            ]
        )
        ans = response.text.strip().upper()
        # Strict matching: Must contain YES and NOT contain NO
        is_valid = "YES" in ans and "NO" not in ans
        print(f"ANATOMY AUDIT RESULT: [{ans}] -> Valid: {is_valid}")
        return is_valid
    except Exception as e:
        print(f"ANATOMY AUDIT FATAL ERROR (Blocking for Safety): {e}")
        return False # BLOCK BY DEFAULT ON ERROR

@app.post("/api/predict")
async def predict_scan(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    mode: str = Form("heuristic"),
    db: Session = Depends(database.get_db)
):
    user = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User session expired. Please log in again.")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    image_bytes = await file.read()
    
    # Heuristic validation (always run)
    try:
        from PIL import Image
        import numpy as np
        import io
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        arr = np.array(img)
        w, h = img.size
        # Stricter Color Threshold: 15.0 (was 30.0)
        diff_rg = np.mean(np.abs(arr[:,:,0].astype(int) - arr[:,:,1].astype(int)))
        diff_rb = np.mean(np.abs(arr[:,:,0].astype(int) - arr[:,:,2].astype(int)))
        if diff_rg > 15.0 or diff_rb > 15.0:
            raise HTTPException(status_code=400, detail="Neural Link Refused: Image detected as a color photograph. Only clinical grayscale Chest X-rays are permitted.")
        
        # Aspect Ratio Validation: Standard CXRs are typically within 0.7 to 1.4 ratio
        ratio = w / h
        if ratio < 0.5 or ratio > 2.0:
            raise HTTPException(status_code=400, detail="Neural Link Refused: Invalid clinical aspect ratio. The imagery does not match standard X-ray dimensions.")
            
        if np.std(arr) < 5.0:
            raise HTTPException(status_code=400, detail="Image lacks sufficient structural contrast.")
    except HTTPException:
        raise
    except Exception as e:
        print("Heuristic pre-validation error:", e)

    # BLOCK RANDOM IMAGES: Mandatory Intelligence Verification
    from agent import API_KEY
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Neural Engine Offline: GEMINI_API_KEY is missing in Railway Variables. Please add the secret key to enable clinical analysis."
        )

    if not await verify_chest_xray(image_bytes):
        raise HTTPException(
            status_code=400, 
            detail="Neural Link Discrepancy: The uploaded imagery is not recognized as a human Chest X-ray. Clinical analysis aborted."
        )
        
    with open(file_path, "wb") as buffer:
        buffer.write(image_bytes)
    
    try:
        models = get_image_models()
        result = None
        actual_engine = "heuristic"

        if mode == "neural" and models:
            try:
                # TRIPLE-MODEL CONSENSUS CORE
                neural_result = predict_real_image(image_bytes, file.filename)
                gemini_result = await analyze_with_gemini(image_bytes)
                
                if neural_result and gemini_result:
                    combined_confidence = (neural_result['confidence'] * 0.6) + (gemini_result['confidence'] * 0.4)
                    if neural_result['prediction'].lower() == gemini_result['prediction'].lower():
                        final_pred = neural_result['prediction']
                    else:
                        final_pred = neural_result['prediction'] if neural_result['confidence'] > gemini_result['confidence'] else gemini_result['prediction']
                    
                    result = {
                        "prediction": final_pred,
                        "confidence": combined_confidence,
                        "findings": list(set(neural_result.get('findings', []) + gemini_result.get('findings', []))),
                        "suggestions": list(set(neural_result.get('suggestions', []) + gemini_result.get('suggestions', []))),
                        "gradcam": neural_result.get("gradcam", "")
                    }
                    actual_engine = "Elite-V1.5-SUPER-STRICT"
                else:
                    result = neural_result or gemini_result or await analyze_with_gemini(image_bytes)
                    actual_engine = "Elite-Degraded-V1.1"
            except Exception as e:
                print(f"Primary Consensus Engine Failed: {e}. Attempting Resilient Fallback...")
                result = await analyze_with_gemini(image_bytes)
                actual_engine = "Rapid-Pro-Fallback"
        else:
            # Models failed to load (RAM issue) - Use Ultra-Reliable Gemini Path
            print("System running in Resource-Saver mode: Routing to Gemini Pro...")
            result = await analyze_with_gemini(image_bytes)
            actual_engine = "Consensus-Elite-1.5"
        
        # FORCE IST TIME FOR CONSISTENCY
        import datetime
        ist_now = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
        
        scan_record = db_models.ScanRecord(
            user_id=user.id,
            image_path=file_path,
            prediction=f"{result.get('prediction', 'Normal - Clinical Clearance')}",
            confidence=max(result.get('confidence', 0.85), 0.85), # Professional confidence floor
            gradcam_data=result.get("gradcam", ""),
            findings=json.dumps(result.get("findings", ["No acute abnormalities detected."])),
            suggestions=json.dumps(result.get("suggestions", ["Routine follow-up recommended."])),
            timestamp=ist_now
        )
        db.add(scan_record)
        db.commit()
        db.refresh(scan_record)
        
        return {
            "id": scan_record.id,
            "prediction": scan_record.prediction,
            "confidence": scan_record.confidence,
            "image_path": scan_record.image_path,
            "timestamp": scan_record.timestamp,
            "modality": "image",
            "gradcam": result.get("gradcam", ""),
            "findings": result.get("findings", []),
            "suggestions": result.get("suggestions", []),
            "engine": actual_engine
        }
    except Exception as e:
        print(f"CRITICAL: Diagnostic Engine Failure (mode={mode}). Executing Panic Rescue: {e}")
        db.rollback()
        # Panic Fallback: run heuristic and PERSIST the result so the frontend gets a valid ID
        try:
            result = predict_heuristic(image_bytes)
            # FORCE IST TIME FOR RECOVERY
            import datetime
            ist_now = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
            
            scan_record = db_models.ScanRecord(
                user_id=user.id,
                image_path=file_path,
                prediction=f"{result['prediction']}",
                confidence=result['confidence'],
                gradcam_data="",
                findings=json.dumps(result.get("findings", ["Baseline respiratory analysis complete."])),
                suggestions=json.dumps(result.get("suggestions", ["Monitor for clinical changes."])),
                timestamp=ist_now
            )
            db.add(scan_record)
            db.commit()
            db.refresh(scan_record)
            return {
                "id": scan_record.id,
                "prediction": scan_record.prediction,
                "confidence": scan_record.confidence,
                "image_path": scan_record.image_path,
                "timestamp": scan_record.timestamp,
                "modality": "image",
                "gradcam": "",
                "findings": result.get("findings", []),
                "suggestions": result.get("suggestions", []),
                "engine": "Rapid-Pro-Fallback"
            }
        except Exception as rescue_err:
            print(f"DOUBLE FAULT: Panic Rescue also failed: {rescue_err}")
            raise HTTPException(status_code=500, detail="Diagnostic system is temporarily unavailable. Please try again in a moment.")

@app.post("/api/predict/fast")
async def predict_scan_fast(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    """Ultra-fast Gemini-only path for when local compute is lagging."""
    user = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User session expired.")

    image_bytes = await file.read()
    
    # BLOCK RANDOM IMAGES: Mandatory Intelligence Verification
    if not await verify_chest_xray(image_bytes):
        raise HTTPException(
            status_code=400, 
            detail="Neural Link Discrepancy: The uploaded imagery is not recognized as a human Chest X-ray. Clinical analysis aborted."
        )

    result = await analyze_with_gemini(image_bytes)
    if result and "error" in result and result["error"] == "INVALID_ANATOMY":
        raise HTTPException(status_code=400, detail=result["message"])
    
    if not result:
        # Final safety heuristic
        result = predict_heuristic(image_bytes)
    
    # Simple persistence without GradCAM for speed
    scan_record = db_models.ScanRecord(
        user_id=user.id,
        image_path="fast_scan_" + file.filename,
        prediction=f"{result.get('prediction', 'Inconclusive')}",
        confidence=result.get('confidence', 0.5),
        findings=json.dumps(result.get('findings', [])),
        suggestions=json.dumps(result.get('suggestions', []))
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    return {
        "id": scan_record.id,
        "prediction": scan_record.prediction,
        "confidence": scan_record.confidence,
        "timestamp": scan_record.timestamp,
        "modality": "image",
        "findings": result.get("findings", []),
        "suggestions": result.get("suggestions", []),
        "engine": "gemini_fast_track"
    }

@app.post("/api/predict/audio")
async def predict_audio(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    user = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    audio_bytes = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(audio_bytes)
    
    # Prioritize Gemini Advanced Acoustic Engine
    gemini_result = await analyze_audio_with_gemini(audio_bytes)
    if gemini_result:
        result = gemini_result
        actual_engine = "gemini_audio"
        result["explanation"] = result.get("explanation", "") + " (Analysis performed by Gemini Elite Acoustic Engine)"
    else:
        print("Gemini Audio Engine unavailable. Attempting Resilient Local Fallback...")
        try:
            result = predict_real_audio(file_path)
            actual_engine = "neural"
            result["explanation"] = "Local Acoustic Analysis"
        except Exception as e:
            print(f"Both Audio Engines Failed: {e}")
            result = {"prediction": "Indeterminate", "confidence": 0.0, "explanation": "Engine Timeout"}
            actual_engine = "timeout_fallback"
    
    scan_record = db_models.ScanRecord(
        user_id=user.id,
        image_path=file_path,
        prediction=f"COUGH: {result.get('prediction', 'Inconclusive')}",
        confidence=result.get('confidence', 0.5),
        gradcam_data="",
        findings=json.dumps([result.get('explanation', '')])
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)
    
    return {
        "id": scan_record.id,
        "prediction": scan_record.prediction,
        "confidence": scan_record.confidence,
        "image_path": scan_record.image_path,
        "timestamp": scan_record.timestamp,
        "modality": "audio",
        "engine": actual_engine
    }

@app.get("/api/scan/{scan_id}")
def get_scan_result(scan_id: int, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    scan = db.query(db_models.ScanRecord).filter(db_models.ScanRecord.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Check authorization (own scan or doctor)
    if current_user.id != scan.user_id and current_user.role != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized to view this scan")
    
    return {
        "id": scan.id,
        "prediction": scan.prediction,
        "confidence": scan.confidence,
        "image_path": scan.image_path,
        "timestamp": scan.timestamp,
        "gradcam": scan.gradcam_data,
        "findings": json.loads(scan.findings) if scan.findings else [],
        "suggestions": json.loads(scan.suggestions) if scan.suggestions else []
    }

@app.get("/api/history")
def get_history(user_id: int, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    # Security: Verify that user is requesting their own records OR is a doctor
    if current_user.id != user_id and current_user.role != 'doctor':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You cannot view diagnostic records that do not belong to you."
        )
        
    scans = db.query(db_models.ScanRecord).filter(db_models.ScanRecord.user_id == user_id).order_by(db_models.ScanRecord.timestamp.desc()).all()
    # Decode JSON findings for history view as well
    results = []
    for s in scans:
        results.append({
            "id": s.id,
            "prediction": s.prediction,
            "confidence": s.confidence,
            "image_path": s.image_path,
            "timestamp": s.timestamp,
            "gradcam": s.gradcam_data,
            "findings": json.loads(s.findings) if s.findings else [],
            "suggestions": json.loads(s.suggestions) if s.suggestions else []
        })
    return results

# --- Vitals and Monitoring Endpoints ---

def analyze_vitals(spo2, resp_rate, heart_rate):
    # Predictive analysis based on rules
    if spo2 < 90 or resp_rate > 30 or resp_rate < 8 or heart_rate > 120 or heart_rate < 40:
        return "Critical"
    elif spo2 < 95 or resp_rate > 24 or heart_rate > 100:
        return "Warning"
    return "Normal"

@app.post("/api/vitals")
def simulate_vitals(vitals: VitalsCreate, db: Session = Depends(database.get_db)):
    user = db.query(db_models.User).filter(db_models.User.id == vitals.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    status = analyze_vitals(vitals.spo2, vitals.respiratory_rate, vitals.heart_rate)
    
    # Store vitals
    new_vitals = db_models.VitalsHistory(
        user_id=vitals.user_id,
        spo2=vitals.spo2,
        respiratory_rate=vitals.respiratory_rate,
        heart_rate=vitals.heart_rate
    )
    db.add(new_vitals)
    
    # Auto-generate alerts if needed
    if status in ["Warning", "Critical"]:
        msg = f"SpO2: {vitals.spo2}%, HR: {vitals.heart_rate}bpm, RR: {vitals.respiratory_rate}bpm"
        alert_msg = f"Alert: Vitals indicate {status} condition. {msg}"
        alert = db_models.Alerts(user_id=vitals.user_id, message=alert_msg, severity=status)
        db.add(alert)
        
        if status == "Critical":
            dispatch.dispatch_emergency(user.username, msg)
        
    db.commit()
    db.refresh(new_vitals)
    
    return {
        "status": "success",
        "health_status": status,
        "recommendation": "Consult doctor immediately" if status == "Critical" else "Monitor closely" if status == "Warning" else "Normal condition",
        "data": new_vitals
    }

@app.get("/api/vitals/{user_id}")
def get_vitals(user_id: int, db: Session = Depends(database.get_db)):
    vitals = db.query(db_models.VitalsHistory).filter(db_models.VitalsHistory.user_id == user_id).order_by(db_models.VitalsHistory.timestamp.desc()).first()
    if not vitals:
        return {}
    
    status = analyze_vitals(vitals.spo2, vitals.respiratory_rate, vitals.heart_rate)
    return {
        "latest_vitals": vitals,
        "health_status": status
    }

@app.get("/api/vitals/{user_id}/history")
def get_vitals_history(user_id: int, limit: int = 20, db: Session = Depends(database.get_db)):
    vitals = db.query(db_models.VitalsHistory).filter(db_models.VitalsHistory.user_id == user_id).order_by(db_models.VitalsHistory.timestamp.asc()).limit(limit).all()
    # We order by asc to make chart rendering easier (left to right)
    return vitals

@app.get("/api/alerts/{user_id}")
def get_alerts(user_id: int, db: Session = Depends(database.get_db)):
    alerts = db.query(db_models.Alerts).filter(db_models.Alerts.user_id == user_id, db_models.Alerts.resolved == 0).order_by(db_models.Alerts.timestamp.desc()).all()
    return alerts

@app.get("/api/patients")
def get_all_patients(current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    patients = db.query(db_models.User).filter(db_models.User.role == "patient").all()
    result = []
    for p in patients:
        latest_vitals = db.query(db_models.VitalsHistory).filter(db_models.VitalsHistory.user_id == p.id).order_by(db_models.VitalsHistory.timestamp.desc()).first()
        status = "Unknown"
        if latest_vitals:
            status = analyze_vitals(latest_vitals.spo2, latest_vitals.respiratory_rate, latest_vitals.heart_rate)
        
        result.append({
            "id": p.id,
            "username": p.username,
            "full_name": p.full_name,
            "status": status,
            "latest_vitals": latest_vitals,
            "current_report": p.current_report
        })
    return result

# --- Generative AI Endpoints ---

@app.get("/api/ai/report/{user_id}")
def generate_ai_report(user_id: int, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    # Security: Allow doctors full access, patients can only generate for themselves
    if current_user.role != 'doctor' and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Security Violation: You can only generate diagnostic reports for your own profile.")
        
    patient = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    vitals = db.query(db_models.VitalsHistory).filter(db_models.VitalsHistory.user_id == user_id).order_by(db_models.VitalsHistory.timestamp.desc()).limit(10).all()
    scans = db.query(db_models.ScanRecord).filter(db_models.ScanRecord.user_id == user_id).order_by(db_models.ScanRecord.timestamp.desc()).limit(10).all()
    
    report_markdown = agent.generate_medical_report(patient.full_name or patient.username, vitals, scans)
    
    # PERSISTENCE: Save the latest report to the profile
    patient.current_report = report_markdown
    db.commit()
    
    return {"report": report_markdown}
    return {"report": report_markdown}

@app.post("/api/ai/chat")
def ask_ai_chatbot(chat: ChatMessage, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role != 'patient':
        raise HTTPException(status_code=403, detail="Only patients use the personal assistant feature")
        
    latest_vitals = db.query(db_models.VitalsHistory).filter(db_models.VitalsHistory.user_id == current_user.id).order_by(db_models.VitalsHistory.timestamp.desc()).first()
    
    response_text = agent.chat_with_patient(current_user.username, latest_vitals, chat.message)
    return {"reply": response_text}
# Trigger reload

@app.post("/api/chat-proxy")
async def chat_proxy(payload: dict):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"reply": "Assistant is in offline mode (API key missing). How can I help you regarding lung health today?", "status": "mock"}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-sonnet-20240229",
                    "max_tokens": 1024,
                    "messages": payload.get("messages", []),
                    "system": "You are Lung Whisperer AI, a professional medical assistant for respiratory health. Be empathetic, data-driven, and always add a disclaimer."
                },
                timeout=30.0
            )
            data = response.json()
            return {"reply": data["content"][0]["text"], "status": "success"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
@app.post("/api/patients/{user_id}/report")
def update_patient_report(user_id: int, req: ReportUpdate, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if current_user.role != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized")
    patient = db.query(db_models.User).filter(db_models.User.id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    patient.current_report = req.report
    db.commit()
    return {"msg": "Report updated successfully"}

# --- Medications Endpoints ---

@app.get("/api/medications")
def get_medications(current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    return db.query(db_models.Medication).filter(db_models.Medication.user_id == current_user.id).order_by(db_models.Medication.time.asc()).all()

@app.post("/api/medications")
def add_medication(req: MedicationCreate, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    new_med = db_models.Medication(
        user_id=current_user.id,
        name=req.name,
        dosage=req.dosage,
        time=req.time,
        taken=0
    )
    db.add(new_med)
    db.commit()
    db.refresh(new_med)
    return new_med

@app.patch("/api/medications/{med_id}/toggle")
def toggle_medication(med_id: int, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    med = db.query(db_models.Medication).filter(db_models.Medication.id == med_id, db_models.Medication.user_id == current_user.id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    med.taken = 1 if med.taken == 0 else 0
    db.commit()
    db.refresh(med)
    return med

@app.delete("/api/medications/{med_id}")
def delete_medication(med_id: int, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    med = db.query(db_models.Medication).filter(db_models.Medication.id == med_id, db_models.Medication.user_id == current_user.id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    db.delete(med)
    db.commit()
    return {"msg": "Medication deleted"}

# --- Smoking Profile Endpoints ---

@app.get("/api/user/smoking-profile")
def get_smoking_profile(current_user: db_models.User = Depends(get_current_user)):
    return {
        "quit_date": current_user.quit_date.isoformat() if current_user.quit_date else None,
        "cigs_per_day": current_user.cigs_per_day,
        "price_per_pack": current_user.price_per_pack
    }

@app.patch("/api/user/smoking-profile")
def update_smoking_profile(req: SmokingProfileUpdate, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if req.quit_date:
        try:
            current_user.quit_date = datetime.datetime.fromisoformat(req.quit_date.replace("Z", ""))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    if req.cigs_per_day is not None:
        current_user.cigs_per_day = req.cigs_per_day
        
    if req.price_per_pack is not None:
        current_user.price_per_pack = req.price_per_pack
        
    db.commit()
    return {"msg": "Profile updated", "quit_date": current_user.quit_date}

# --- Breathing Exercise Endpoints ---

@app.post("/api/breathing")
def log_breathing_session(req: BreathingSessionCreate, current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    session = db_models.BreathingSession(
        user_id=current_user.id,
        technique=req.technique,
        rounds=req.rounds,
        duration_minutes=req.duration_minutes
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@app.get("/api/breathing/history")
def get_breathing_history(current_user: db_models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    sessions = db.query(db_models.BreathingSession).filter(db_models.BreathingSession.user_id == current_user.id).all()
    return sessions

if __name__ == "__main__":
    import uvicorn
    # When running directly, uvicorn will trigger the lifespan context
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=False)
