from sqlalchemy import Column, Integer, String, Text, LargeBinary, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ProcessingStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Note(Base):
    """Note model for storing uploaded notes."""
    
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    
    # Image storage
    original_image = Column(LargeBinary, nullable=False)
    image_filename = Column(String(255))
    image_mimetype = Column(String(100))
    
    # OCR results
    raw_text = Column(Text)
    structured_text = Column(Text)
    
    # Organization
    subject = Column(String(100))
    topic = Column(String(100))
    tags = Column(String(500))
    
    # Status
    status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Foreign key to user
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="notes")
