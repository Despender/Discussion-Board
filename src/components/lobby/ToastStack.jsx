import './ToastStack.css';

export default function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast-stack__item alert alert-dark mb-2 py-2 px-3">
          {t.message}
        </div>
      ))}
    </div>
  );
}
