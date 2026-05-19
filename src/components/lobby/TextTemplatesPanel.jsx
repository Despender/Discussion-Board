import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { TEXT_TEMPLATES } from '../../constants/textTemplates';

export default function TextTemplatesPanel({ show, onHide, onPick }) {
  return (
    <Modal show={show} onHide={onHide} centered className="text-templates-modal">
      <Modal.Header closeButton className="bg-dark text-light border-secondary">
        <Modal.Title>Заготовки тексту</Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-dark text-light">
        <p className="small text-muted">Оберіть шаблон — на полотні з’явиться нове текстове вікно.</p>
        <div className="d-grid gap-2">
          {TEXT_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              variant="outline-light"
              className="text-start"
              onClick={() => {
                onPick(t);
                onHide();
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}
