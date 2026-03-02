import librosa
import numpy as np
from scipy.signal import butter, lfilter

SAMPLE_RATE = 22050
DURATION = 6
SAMPLES = SAMPLE_RATE * DURATION

def bandpass_filter(data, low=100, high=2500):
    nyq = 0.5 * SAMPLE_RATE
    b, a = butter(4, [low/nyq, high/nyq], btype='band')
    return lfilter(b, a, data)

def preprocess_audio(path):
    signal, sr = librosa.load(path, sr=SAMPLE_RATE)
    if len(signal) < SAMPLES:
        signal = np.pad(signal, (0, SAMPLES - len(signal)))
    else:
        signal = signal[:SAMPLES]
    signal = bandpass_filter(signal)
    signal = librosa.util.normalize(signal)
    return signal

def extract_features(signal):
    mfcc = librosa.feature.mfcc(signal, sr=SAMPLE_RATE, n_mfcc=40)
    return mfcc
