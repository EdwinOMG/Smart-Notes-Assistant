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
        title: Optional[str] = None,
        note_type: str = "default"
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
        
        # Perform OCR with Gemini
        try:
            ocr_result = extract_structured_text(file_content, note_type=note_type)
            
            # Check for errors from Gemini
            if ocr_result.get('error'):
                raise Exception(ocr_result['error'])
            
            # Build formatted HTML from elements
            html_parts = []
            elements = ocr_result.get('elements', [])
            
            # Sort by position
            sorted_elements = sorted(elements, key=lambda e: (e.get('position', {}).get('y_percent', 0), e.get('position', {}).get('x_percent', 0)))
            
            for element in sorted_elements:
                el_type = element.get('type', '')
                content = element.get('content', '')
                container = element.get('container', 'none')
                style = element.get('style', {})
                children = element.get('children', [])
                
                # Build inline styles based on container type
                container_style = ''
                if container == 'box':
                    container_style = 'border: 2px solid #FFB74D; border-radius: 8px; padding: 12px 16px; background: #FFF8E1; margin: 10px 0;'
                elif container == 'underlined':
                    container_style = 'border-bottom: 3px solid #FF9800; padding-bottom: 4px;'
                elif container == 'circled':
                    container_style = 'border: 2px solid #FFB74D; border-radius: 50px; padding: 6px 16px; display: inline-block;'
                
                if el_type == 'header':
                    size = '1.6em' if style.get('is_large') else '1.3em'
                    html_parts.append(f'<h2 style="font-size: {size}; color: #5D4037; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; {container_style}">{content}</h2>')
                
                elif el_type == 'bullet_list':
                    bullets_html = ''.join([f'<div style="display: flex; gap: 10px; margin-bottom: 8px;"><span style="color: #FF9800; font-weight: bold;">◆</span><span>{child}</span></div>' for child in children])
                    html_parts.append(f'<div style="margin: 15px 0; {container_style}">{bullets_html}</div>')
                
                elif el_type == 'key_value':
                    parts = content.split(':', 1)
                    if len(parts) == 2:
                        html_parts.append(f'<div style="margin: 10px 0; {container_style}"><span style="color: #FF9800; font-weight: bold; text-transform: uppercase;">{parts[0]}:</span> {parts[1]}</div>')
                    else:
                        html_parts.append(f'<div style="margin: 10px 0; {container_style}">{content}</div>')
                
                elif el_type == 'diagram':
                    diagram = element.get('diagram', {})
                    desc = diagram.get('description', content)
                    labels = diagram.get('labels', [])
                    labels_text = ', '.join(labels) if labels else ''
                    labels_html = f'<div style="margin-top: 8px; color: #FF9800;">Labels: {labels_text}</div>' if labels_text else ''
                    html_parts.append(f'<div style="border: 2px dashed #FFB74D; border-radius: 12px; padding: 20px; margin: 15px 0; background: #FFF8E1; text-align: center;"><div style="color: #5D4037; font-style: italic;">📊 {desc}</div>{labels_html}</div>')
                
                elif el_type == 'paragraph':
                    weight = 'bold' if style.get('is_bold') else 'normal'
                    html_parts.append(f'<p style="margin: 12px 0; line-height: 1.8; font-weight: {weight}; {container_style}">{content}</p>')
                
                else:
                    if content:
                        html_parts.append(f'<p style="margin: 12px 0; line-height: 1.8; {container_style}">{content}</p>')
            
            structured_html = ''.join(html_parts) if html_parts else ''
            
            # Fallback to raw_text if no HTML generated
            if not structured_html:
                # Build from text_parts as before
                text_parts = []
                for element in sorted_elements:
                    el_type = element.get('type', '')
                    content = element.get('content', '')
                    children = element.get('children', [])
                    
                    if el_type == 'header':
                        text_parts.append(f"\n{content}\n")
                    elif el_type == 'bullet_list':
                        for child in children:
                            text_parts.append(f"  • {child}")
                    elif el_type == 'diagram':
                        diagram = element.get('diagram', {})
                        text_parts.append(f"[Diagram: {diagram.get('description', content)}]")
                    elif content:
                        text_parts.append(content)
                
                raw_text = '\n'.join(text_parts) if text_parts else ''
                if not raw_text and ocr_result.get('raw_text'):
                    raw_text = ocr_result['raw_text']
                structured_html = raw_text.replace('\n', '<br>')

            note.raw_text = ocr_result.get('raw_text', '')
            note.structured_text = structured_html
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
