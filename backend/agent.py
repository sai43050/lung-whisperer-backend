import os
import json
from dotenv import load_dotenv
load_dotenv()

# Try importing the new Google GenAI library
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# It automatically loads GEMINI_API_KEY if present
API_KEY = os.getenv("GEMINI_API_KEY", "")

def get_client():
    if not API_KEY or not genai:
        return None
    try:
        return genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"Gemini client initialization failed: {e}")
        return None

def generate_medical_report(patient_name, vitals_history, scan_history):
    """
    Synthesizes the raw vital JSON and prediction strings into a deep clinical narrative.
    """
    client = get_client()
    
    # Calculate Trends for better AI context
    spo2_vals = [v.spo2 for v in vitals_history] if vitals_history else [0]
    hr_vals = [v.heart_rate for v in vitals_history] if vitals_history else [0]
    rr_vals = [v.respiratory_rate for v in vitals_history] if vitals_history else [0]
    
    avg_spo2 = sum(spo2_vals) / len(spo2_vals) if spo2_vals else 0
    max_hr = max(hr_vals) if hr_vals else 0
    
    vitals_context = f"""
    EPIC-LEVEL VITALS ANALYSIS:
    - Sample Size: {len(vitals_history)} telemetry pings
    - Average SpO2: {avg_spo2:.2f}% (Min: {min(spo2_vals):.2f}%)
    - Peak Heart Rate observed: {max_hr} bpm
    - Respiratory Variability: {min(rr_vals)}-{max(rr_vals)} breaths/min
    """
    
    scan_context = "DIAGNOSTIC SCAN LOGS:\n"
    for idx, scan in enumerate(scan_history[:5]):
        scan_context += f"[{idx+1}] Modality: {scan.modality.upper()} | Output: {scan.prediction} | Confidence: {scan.confidence*100:.1f}%\n"

    prompt = f"""
    ROLE: You are the Lead AI Medical Officer for Lung Whisperer.
    PATIENT: {patient_name}
    
    DATASET:
    {vitals_context}
    {scan_context}
    
    TASK: Generate a COMPREHENSIVE MEDICAL ASSESSMENT in professional Markdown format.
    
    STRUCTURE:
    # 📑 LUNG WHISPERER CLINICAL SUMMARY
    ## I. Clinical Impression
    Provide a high-level summary of the patient's current respiratory state. Analyze the correlation between the ML scan predictions and the live vitals.
    
    ## II. Physiological Trend Analysis
    Analyze the SpO2 and Heart Rate stability. Mention if there's evidence of hypoxia or tachycardia based on the trends provided.
    
    ## III. Multi-Modal Diagnostic Cross-Check
    Do the X-ray findings and Cough findings align or conflict? (e.g., "Consistent with Viral Pneumonia across both modalities").
    
    ## IV. Triage & Strategic Recommendations
    List 3-4 specific clinical next steps (e.g., Bronchoscopy consult, repeated SpO2 tracking, steroid therapy consideration).
    
    DISCLAIMER: State clearly that this is an AI-generated synthesis for clinical support and requires manual MD sign-off.
    """

    if not client:
        return _mock_report(patient_name)

    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"Gemini Inference Error: {e}")
        return _mock_report(patient_name)

def chat_with_patient(patient_name, latest_vitals, user_message):
    """
    Context-aware chatbot for the patient dashboard.
    """
    client = get_client()
    
    vtext = "No recent vitals."
    if latest_vitals:
        vtext = f"Live Vitals - SpO2: {latest_vitals.spo2}%, HR: {latest_vitals.heart_rate}bpm, RR: {latest_vitals.respiratory_rate}bpm."
        
    prompt = f"""
    You are RespiraBot, a helpful digital health companion for {patient_name}.
    You have secure access to their live telemetry: {vtext}.
    
    A patient just asked you the following question: "{user_message}"
    
    Respond in 2-3 short sentences. Be empathetic and directly answer their question utilizing their live vitals if relevant. Never definitively diagnose them. 
    """

    if not client:
        return _mock_chat(user_message, latest_vitals)

    try:
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"Gemini Inference Error: {e}")
        return _mock_chat(user_message, latest_vitals)


def _mock_report(patient_name):
    return f"""
### 1. Current Diagnostic Status
Patient **{patient_name}** shows multiple logged predictive modalities. While specific inference models detected anomalies related to viral pneumonia vectors, the localized aggregation suggests the patient is recovering. *(Mock Generated)*

### 2. Vital Sign Analysis
SpO2 remains largely stable, though erratic respiratory rates were logged during nighttime cycles. Heart rate fluctuates between normal clinical thresholds.

### 3. Recommended Actions
- Prescribe rest and elevate posture.
- Monitor cough severity over the next 48 hours.
- Repeat acoustic model sampling on Day 3.

> **Disclaimer**: This is an AI-generated mock summary. No real API key was provided.
"""

def _mock_chat(user_message, latest_vitals):
    spo2 = latest_vitals.spo2 if latest_vitals else "unknown"
    return f"I am operating in mock mode (No Gemini API Key). However, looking at your SpO2 of {spo2}%, I advise you to stay hydrated!"
