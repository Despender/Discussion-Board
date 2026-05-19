import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import FontSelector from './FontSelector';
import { ALL_FONTS } from '../constants/fonts';
import { createLobby, getLobby, getLobbyShareUrl } from '../services/lobbyService';
import { useUser } from '../context/UserContext';
import { isFirebaseConfigured } from '../firebase/config';

export default function LobbyMenu({ show, onHide }) {
  const navigate = useNavigate();
  const { userId, profile } = useUser();
  const [mode, setMode] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [fontId, setFontId] = useState('times');
  const [fontSize, setFontSize] = useState(18);
  const [loading, setLoading] = useState(false);

  const selectedFont = ALL_FONTS.find((f) => f.id === fontId) || ALL_FONTS[0];

  const reset = () => {
    setMode(null);
    setJoinCode('');
    setError('');
    setCreatedCode('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onHide();
  };

  const enterLobby = async (code) => {
    setLoading(true);
    setError('');
    const lobby = await getLobby(code);
    if (!lobby) {
      setError('Лобі з таким кодом не знайдено');
      setLoading(false);
      return;
    }
    navigate(`/lobby/${code}`);
    handleClose();
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const code = await createLobby({
        hostId: userId,
        hostNickname: profile.nickname,
        hostColor: profile.color,
        fontId,
        fontFamily: selectedFont.family,
        fontSize,
        arrowColor: profile.arrowColor,
      });
      setCreatedCode(code);
    } catch {
      setError('Помилка створення лобі');
    }
    setLoading(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = joinCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setError('Код має містити 6 цифр');
      return;
    }
    await enterLobby(code);
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="lobby-menu-modal">
      <Modal.Header closeButton className="bg-dark text-light border-secondary">
        <Modal.Title>Лобі</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        {!isFirebaseConfigured && (
          <div className="alert alert-warning py-2 small">
            Firebase не налаштовано — працює локальний режим (дані лише в цій вкладці).
            Скопіюйте <code>.env.example</code> у <code>.env</code> і додайте ключі.
          </div>
        )}

        {!mode && !createdCode && (
          <div className="d-grid gap-2">
            <Button variant="primary" size="lg" onClick={() => setMode('create')}>
              Створити лобі
            </Button>
            <Button variant="outline-light" size="lg" onClick={() => setMode('join')}>
              Приєднатися за кодом
            </Button>
          </div>
        )}

        {mode === 'create' && !createdCode && (
          <>
            <FontSelector
              fontId={fontId}
              fontSize={fontSize}
              onFontChange={(f) => setFontId(f.id)}
              onSizeChange={setFontSize}
            />
            <div className="d-grid mt-3">
              <Button variant="success" onClick={handleCreate} disabled={loading}>
                {loading ? 'Створення…' : 'Створити'}
              </Button>
              <Button variant="link" className="text-secondary" onClick={() => setMode(null)}>
                Назад
              </Button>
            </div>
          </>
        )}

        {createdCode && (
          <div className="text-center">
            <p className="mb-2">Лобі створено!</p>
            <p className="display-6 fw-bold text-info">{createdCode}</p>
            <p className="small text-muted mb-3">
              Посилання для друзів:
              <br />
              <a href={getLobbyShareUrl(createdCode)} className="text-break">
                {getLobbyShareUrl(createdCode)}
              </a>
            </p>
            <Button
              variant="primary"
              onClick={() => enterLobby(createdCode)}
              disabled={loading}
            >
              Увійти в лобі
            </Button>
          </div>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin}>
            <label className="form-label">Код лобі (6 цифр)</label>
            <input
              type="text"
              className="form-control form-control-lg text-center mb-3"
              placeholder="123456"
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                Приєднатися
              </Button>
              <Button type="button" variant="link" className="text-secondary" onClick={() => setMode(null)}>
                Назад
              </Button>
            </div>
          </form>
        )}

        {error && <p className="text-danger mt-3 mb-0">{error}</p>}
      </Modal.Body>
    </Modal>
  );
}
