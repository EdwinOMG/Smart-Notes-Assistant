# Smart Notes Assistant

**Authors:** Edwin Morales Jr, Karim Elneshili, Tyler Long  
**Institution:** SUNY New Paltz  

---

## Overview

Smart Notes Assistant is a smart note-digitization system that converts handwritten notes into structured digital content and provides AI-powered explanations for highlighted text.  

The project creates a **scalable, modular, and deployable system** to help users organize, understand, and interact with their notes efficiently.  

**Key features include:**

- Convert handwritten notes into clean, searchable digital text  
- Automatically categorize notes by subject or topic  
- Highlight text and receive AI-generated explanations  
- Dashboard to view notes by subject or topic  

---

## Project Goals

### User Goals

- Turn handwritten notes into digital notes  
- Automatically categorize notes by subject/topic  
- Help users understand highlighted content via AI  

### System Goals

- Handle uploads and background processing efficiently  
- Separate responsibilities across modular layers  
- Scalable and deployable to multiple users  

---

## Architecture

The system follows a **layered architecture**:

### 1. Client Layer (Frontend)

**Technology:** React (web) with potential migration to React Native + Tailwind for mobile  

**Responsibilities:**

- User authentication  
- Upload handwritten note images via file input (camera optional later)  
- Display converted digital notes  
- Highlight text and request explanations  
- View categorized notes by subject/topic  
- Communicate with backend via REST API (FastAPI)  

---

### 2. API Layer (Backend)

**Technology:** Python + FastAPI  

**Responsibilities:**

- Authentication & authorization  
- Request validation  
- Orchestration (delegates heavy tasks, does not do OCR inline)  
- Expose REST endpoints to frontend  

---

### 3. Storage Layer

**Components:** PostgreSQL (structured data), Redis + Celery (task queue)  

**Responsibilities:**

- Store structured note data and metadata  
- Separate storage by type (text vs. images)  
- Enable asynchronous background processing via Celery  
- Support scalability and future reprocessing of notes  

**Monkey Analogy:**  
- **API** = you handing a note to the mailbox  
- **Redis** = the mailbox storing the note safely  
- **Celery worker** = the monkey that peels the bananas (does the processing)  

---

## Key Components

- **Upload Screen:** Capture or upload handwritten notes  
- **Categorized Notes View:** Browse notes organized by subject/topic  
- **Highlight + Explain:** Highlight text and request AI explanations  
- **Subject/Topic Dashboard:** Visualize notes by categories  

---

## Example Endpoints

| Endpoint             | Method | Description                               |
|---------------------|--------|-------------------------------------------|
| `/upload-note`      | POST   | Upload handwritten note image             |
| `/notes`            | GET    | Retrieve all notes                        |
| `/notes/{id}`       | GET    | Retrieve a single note by ID              |
| `/explain-highlight`| POST   | Get AI explanation for highlighted text   |
| `/subjects`         | GET    | Retrieve list of subjects/topics          |

---
Hi Professor!
