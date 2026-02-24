import { useState, useEffect } from 'react';
import { notesAPI } from '../services/api';
import { Note, NoteWithImage } from '../types';

interface DashboardProps {
  userEmail: string;
  onLogout: () => void;
}

export default function Dashboard({ userEmail, onLogout }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteWithImage | null>(null);
  const [editedText, setEditedText] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const data = await notesAPI.getAll();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('🍌 Peeling your notes...');

    try {
      const newNote = await notesAPI.upload(file);
      setNotes([newNote, ...notes]);
      await viewNote(newNote);
      setMessage('🐵 Note peeled successfully!');
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const viewNote = async (note: Note) => {
    try {
      const fullNote = await notesAPI.getById(note.id);
      setSelectedNote(fullNote);
      setEditedText(fullNote.structured_text || fullNote.raw_text || '');
    } catch (err) {
      setMessage('Error loading note: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;

    try {
      await notesAPI.update(selectedNote.id, { structured_text: editedText });
      setSelectedNote({ ...selectedNote, structured_text: editedText });
      setMessage('🐵 Note saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error saving: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  const deleteNote = async (noteId: number) => {
    if (!window.confirm('Delete this note?')) return;

    try {
      await notesAPI.delete(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setEditedText('');
      }
      setMessage('Note deleted');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error deleting: ' + (err instanceof Error ? err.message : 'Failed'));
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <div style={{
        width: '300px',
        borderRight: '1px solid #FFE082',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #FFF8E1 0%, #FFECB3 100%)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #FFE082' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <span style={{ fontSize: '30px' }}>🐵🍌</span>
            <h2 style={{ margin: 0, color: '#5D4037' }}>NotePeel</h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8D6E63', fontSize: '14px' }}>{userEmail}</span>
            <button
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#FF9800',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Upload */}
        <div style={{ padding: '15px' }}>
          <div style={{
            padding: '20px',
            background: 'white',
            borderRadius: '12px',
            border: '2px dashed #FFB74D',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>📷</div>
            <p style={{ margin: '0 0 10px', color: '#8D6E63', fontSize: '14px' }}>
              Upload handwritten note
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ width: '100%' }}
            />
            {uploading && (
              <p style={{ margin: '10px 0 0', color: '#FF9800', fontWeight: 'bold' }}>
                🍌 Peeling...
              </p>
            )}
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px 15px' }}>
          <h3 style={{ margin: '0 0 10px', color: '#5D4037' }}>
            Your Notes ({notes.length})
          </h3>
          {loading ? (
            <p style={{ color: '#8D6E63' }}>Loading...</p>
          ) : notes.length === 0 ? (
            <p style={{ color: '#8D6E63' }}>No notes yet. Start peeling! 🍌</p>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                onClick={() => viewNote(note)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  background: selectedNote?.id === note.id ? '#FFE082' : 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: selectedNote?.id === note.id ? '2px solid #FFA000' : '1px solid #FFE082',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#5D4037' }}>
                      {note.title || 'Untitled'}
                    </strong>
                    <br />
                    <small style={{ color: '#8D6E63' }}>
                      {new Date(note.created_at).toLocaleDateString()}
                    </small>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                    style={{
                      background: '#FF5252',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#FFFDF5' }}>
        {message && (
          <div style={{
            padding: '12px 15px',
            marginBottom: '15px',
            background: message.includes('Error') ? '#ffebee' : '#FFF8E1',
            color: message.includes('Error') ? '#c62828' : '#5D4037',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            border: message.includes('Error') ? '1px solid #ef9a9a' : '1px solid #FFE082'
          }}>
            {message}
            <button
              onClick={() => setMessage('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        )}

        {selectedNote ? (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: '#5D4037' }}>
                {selectedNote.title || 'Untitled Note'}
              </h2>
              <button
                onClick={saveNote}
                style={{
                  padding: '12px 25px',
                  background: 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)',
                  color: '#5D4037',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                🐵 Save Changes
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Original Image */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #FFE082'
              }}>
                <h3 style={{ marginTop: 0, color: '#5D4037' }}>📷 Original Image</h3>
                {selectedNote.image_base64 && (
                  <img
                    src={`data:${selectedNote.image_mimetype};base64,${selectedNote.image_base64}`}
                    alt="Note"
                    style={{
                      maxWidth: '100%',
                      borderRadius: '8px',
                      border: '1px solid #FFE082'
                    }}
                  />
                )}
              </div>

              {/* Editable Text */}
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #FFE082'
              }}>
                <h3 style={{ marginTop: 0, color: '#5D4037' }}>🍌 Peeled Text (Editable)</h3>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '400px',
                    padding: '15px',
                    border: '2px solid #FFE082',
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'vertical',
                    fontFamily: 'Georgia, serif',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: '150px', color: '#8D6E63' }}>
            <div style={{ fontSize: '80px', marginBottom: '20px' }}>🐵🍌</div>
            <h2 style={{ color: '#5D4037' }}>Ready to peel some notes?</h2>
            <p>Upload a photo of your handwritten notes to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
