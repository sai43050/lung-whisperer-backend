from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(String, default="patient")  # "patient", "doctor", "admin"
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    current_report = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    medications = relationship("Medication", back_populates="owner", cascade="all, delete-orphan")
    
    # Smoking Tracker Fields
    quit_date = Column(DateTime, nullable=True)
    cigs_per_day = Column(Integer, default=20)
    price_per_pack = Column(Integer, default=500)

class VitalsHistory(Base):
    __tablename__ = "vitals_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    spo2 = Column(Float)
    respiratory_rate = Column(Float)
    heart_rate = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("User", back_populates="vitals")

class Alerts(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    severity = Column(String) # "Warning", "Critical"
    resolved = Column(Integer, default=0) # 0 for False, 1 for True
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("User", back_populates="alerts")

class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    image_path = Column(String) 
    prediction = Column(String) 
    confidence = Column(Float)  
    gradcam_data = Column(String, nullable=True) 
    findings = Column(String, nullable=True) # JSON encoded string
    suggestions = Column(String, nullable=True) # JSON encoded string
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="scans")

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    dosage = Column(String)
    time = Column(String)
    taken = Column(Integer, default=0) # 0 for False, 1 for True
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="medications")
