import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import './TextFormatBar.css';

const COLORS = ['#f2f3f5', '#fee75c', '#57f287', '#ed4245', '#5865f2', '#eb459e'];

export default function TextFormatBar({
  align,
  highlightColor,
  onAlign,
  onBold,
  onItalic,
  onColor,
  onFinalize,
  showFinalize,
}) {
  return (
    <div className="text-format-bar" onPointerDown={(e) => e.stopPropagation()}>
      <ButtonGroup size="sm">
        <Button
          variant={align === 'left' ? 'primary' : 'outline-secondary'}
          onClick={() => onAlign('left')}
          title="Ліворуч"
        >
          ≡
        </Button>
        <Button
          variant={align === 'center' ? 'primary' : 'outline-secondary'}
          onClick={() => onAlign('center')}
          title="По центру"
        >
          ≡
        </Button>
        <Button
          variant={align === 'right' ? 'primary' : 'outline-secondary'}
          onClick={() => onAlign('right')}
          title="Праворуч"
        >
          ≡
        </Button>
        <Button
          variant={align === 'justify' ? 'primary' : 'outline-secondary'}
          onClick={() => onAlign('justify')}
          title="По ширині"
        >
          ≣
        </Button>
      </ButtonGroup>

      <ButtonGroup size="sm" className="ms-1">
        <Button variant="outline-secondary" onClick={onBold} title="Жирний">
          <strong>B</strong>
        </Button>
        <Button variant="outline-secondary" onClick={onItalic} title="Курсив">
          <em>I</em>
        </Button>
      </ButtonGroup>

      <div className="text-format-bar__colors ms-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`text-format-bar__color${highlightColor === c ? ' is-active' : ''}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            title="Колір виділення"
          />
        ))}
      </div>

      {showFinalize && (
        <Button variant="success" size="sm" className="ms-1" onClick={onFinalize} title="Завершити речення">
          ✓
        </Button>
      )}
    </div>
  );
}
