from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
import base64

from app.models.note import Note, ProcessingStatus
from app.models.user import User
from app.schemas.note_schema import NoteUpdate

# Import OCR service
import sys
sys.path.insert(0, '..')
from ocr_service import extract_structured_text


class NoteController:
    """Controller for note operations."""
    
    @staticmethod
    async def create_note(
        db: Session,
        file: UploadFile,
        user: User,
        title: Optional[str] = None
    ) -> Note:
        """Create a new note from an uploaded image."""
        file_content = await file.read()
        
        # Create note record
        note = Note(
            title=title or file.filename,
            original_image=file_content,
            image_filename=file.filename or "uploaded_image",
            image_mimetype=file.content_type or "image/png",
            status=ProcessingStatus.PROCESSING,
            owner_id=user.id
        )
        
        db.add(note)
        db.commit()
        db.refresh(note)
        
        # Perform OCR
        try:
            ocr_result = extract_structured_text(file_content)
            raw_text = ocr_result.get('raw_text', '')
            
            # If raw_text is empty, try to build it from key_values and table_rows
            if not raw_text:
                parts = []
                if ocr_result.get('key_values'):
                    for k, v in ocr_result['key_values'].items():
                        parts.append(f"{k}: {v}")
                if ocr_result.get('table_rows'):
                    for row in ocr_result['table_rows']:
                        parts.append(' '.join(row))
                raw_text = '\n'.join(parts)
            
            note.raw_text = raw_text
            note.structured_text = raw_text
            note.status = ProcessingStatus.COMPLETED
            note.processed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(note)
            
        except Exception as e:
            note.status = ProcessingStatus.FAILED
            note.error_message = str(e)
            db.commit()
            db.refresh(note)
        
        return note
    
    @staticmethod
    def get_notes(
        db: Session,
        user: User,
        skip: int = 0,
        limit: int = 100
    ) -> List[Note]:
        """Get all notes for a user."""
        return db.query(Note).filter(
            Note.owner_id == user.id
        ).order_by(Note.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_note(db: Session, note_id: int, user: User) -> Note:
        """Get a specific note by ID."""
        note = db.query(Note).filter(
            Note.id == note_id,
            Note.owner_id == user.id
        ).first()
        
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note not found"
            )
        
        return note
    
    @staticmethod
    def get_note_with_image(db: Session, note_id: int, user: User) -> dict:
        """Get a note with its image as base64."""
        note = NoteController.get_note(db, note_id, user)
        
        return {
            "id": note.id,
            "title": note.title,
            "image_filename": note.image_filename,
            "image_mimetype": note.image_mimetype,
            "image_base64": base64.b64encode(note.original_image).decode('utf-8'),
            "raw_text": note.raw_text,
            "structured_text": note.structured_text,
            "subject": note.subject,
            "topic": note.topic,
            "tags": note.tags,
            "status": note.status.value if hasattr(note.status, 'value') else str(note.status),
            "error_message": note.error_message,
            "created_at": note.created_at,
            "processed_at": note.processed_at,
        }
    
    @staticmethod
    def update_note(db: Session, note_id: int, update_data: NoteUpdate, user: User) -> Note:
        """Update a note."""
        note = NoteController.get_note(db, note_id, user)
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(note, field, value)
        
        db.commit()
        db.refresh(note)
        
        return note
    
    @staticmethod
    def delete_note(db: Session, note_id: int, user: User) -> None:
        """Delete a note."""
        note = NoteController.get_note(db, note_id, user)
        db.delete(note)
        db.commit()


note_controller = NoteController()
