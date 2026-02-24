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
            
            # Build raw_text from the new structured format
            text_parts = []
            
            # Add headers
            if ocr_result.get('headers'):
                text_parts.extend(ocr_result['headers'])
            
            # Add paragraphs
            if ocr_result.get('paragraphs'):
                text_parts.extend(ocr_result['paragraphs'])
            
            # Add bullet points
            if ocr_result.get('bullet_points'):
                text_parts.extend(ocr_result['bullet_points'])
            
            # Add key-values (now it's a list or dict)
            key_values = ocr_result.get('key_values', {})
            if isinstance(key_values, dict):
                for k, v in key_values.items():
                    text_parts.append(f"{k}: {v}")
            elif isinstance(key_values, list):
                text_parts.extend([str(kv) for kv in key_values])
            
            # Add tables
            if ocr_result.get('tables'):
                for table in ocr_result['tables']:
                    if isinstance(table, list):
                        for row in table:
                            if isinstance(row, list):
                                text_parts.append(' | '.join(row))
                            else:
                                text_parts.append(str(row))
            
            # Add sections content
            if ocr_result.get('sections'):
                for section in ocr_result['sections']:
                    if section.get('title'):
                        text_parts.append(section['title'])
                    for item in section.get('content', []):
                        if isinstance(item, dict) and item.get('text'):
                            text_parts.append(item['text'])
            
            raw_text = '\n'.join(text_parts) if text_parts else ''
            
            if not raw_text and ocr_result.get('raw_text'):
                raw_text = ocr_result['raw_text']

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