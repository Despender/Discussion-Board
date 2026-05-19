import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pruneEmptyLobbies } from '../services/lobbyService';
import { isLobbyMenuSearch } from '../utils/appNavigation';
import Button from 'react-bootstrap/Button';
import ColorPicker from '../components/ColorPicker';
import ArrowPreview from '../components/ArrowPreview';
import LobbyMenu from '../components/LobbyMenu';
import { useUser } from '../context/UserContext';
import './HomePage.css';

export default function HomePage() {
  const { profile, setProfile } = useUser();
  const [searchParams] = useSearchParams();
  const [showLobby, setShowLobby] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  useEffect(() => {
    void pruneEmptyLobbies();
  }, []);

  useEffect(() => {
    if (isLobbyMenuSearch() || searchParams.get('lobbyMenu') === '1') {
      setShowLobby(true);
    }
  }, [searchParams]);

  const canLaunch = profile.nickname.trim().length >= 2;

  const openLobby = () => {
    if (!canLaunch) {
      setNicknameError('Нікнейм має містити щонайменше 2 символи');
      return;
    }
    setNicknameError('');
    setShowLobby(true);
  };

  return (
    <div className="home-page">
      <div className="home-page__card card shadow-lg">
        <div className="card-body p-4 p-md-5">
          <h1 className="home-page__title h3 mb-1">Дошка дискусій</h1>
          <p className="home-page__subtitle mb-4">
            Спільне полотно для аргументації та наслідків. Оберіть нікнейм, колір ніка та
            колір стрілок, потім запустіть лобі.
          </p>

          <div className="row g-4">
            <div className="col-lg-4">
              <label className="form-label" htmlFor="nickname">
                Нікнейм
              </label>
              <input
                id="nickname"
                type="text"
                className="form-control form-control-lg"
                placeholder="Ваш нік"
                maxLength={24}
                value={profile.nickname}
                onChange={(e) => {
                  setProfile({ nickname: e.target.value });
                  setNicknameError('');
                }}
              />
              {nicknameError && (
                <p className="text-danger small mt-1 mb-0">{nicknameError}</p>
              )}
              <p
                className="mt-3 mb-0 fw-semibold"
                style={{ color: profile.color }}
              >
                Попередній перегляд: {profile.nickname || '…'}
              </p>
            </div>

            <div className="col-lg-4">
              <label className="form-label">Колір ніка</label>
              <ColorPicker
                value={profile.color}
                onChange={(color) => setProfile({ color })}
              />
            </div>

            <div className="col-lg-4">
              <label className="form-label">Колір стрілок</label>
              <ColorPicker
                value={profile.arrowColor || '#5865f2'}
                onChange={(color) => setProfile({ arrowColor: color })}
              />
              <ArrowPreview color={profile.arrowColor || '#5865f2'} />
            </div>
          </div>

          <div className="d-grid mt-4">
            <Button
              variant="primary"
              size="lg"
              onClick={openLobby}
              disabled={!canLaunch}
            >
              Запустити лобі
            </Button>
          </div>
        </div>
      </div>

      <LobbyMenu show={showLobby} onHide={() => setShowLobby(false)} />
    </div>
  );
}
