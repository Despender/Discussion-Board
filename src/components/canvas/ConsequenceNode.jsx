import './ConsequenceNode.css';

export default function ConsequenceNode({ consequence }) {
  const { symbolX, symbolY } = consequence;

  return (
    <div
      className="consequence-node"
      style={{ left: symbolX, top: symbolY }}
      aria-hidden
    >
      <div className="consequence-node__symbol">⟹</div>
    </div>
  );
}
