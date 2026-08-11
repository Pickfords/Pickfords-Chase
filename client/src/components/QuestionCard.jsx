import './questioncard.css';

export default function QuestionCard({ question, selectedAnswer, onSelect, locked, revealedCorrectAnswer }) {
  if (!question) return null;
  const options = ['A', 'B', 'C'];

  return (
    <div className="pf-qcard">
      <div className="pf-qcard-meta pf-mono">
        Q{question.slot} / {question.totalSlots} · {question.category} · Level {question.difficulty}
      </div>
      <div className="pf-qcard-question">{question.question}</div>
      <div className="pf-qcard-options">
        {options.map((key) => {
          const label = question.options[key];
          if (!label) return null;
          const isSelected = selectedAnswer === key;
          const isRevealCorrect = revealedCorrectAnswer && key === revealedCorrectAnswer;
          const isRevealWrongSelected = revealedCorrectAnswer && isSelected && key !== revealedCorrectAnswer;
          return (
            <button
              key={key}
              type="button"
              className={[
                'pf-option',
                isSelected ? 'selected' : '',
                isRevealCorrect ? 'reveal-correct' : '',
                isRevealWrongSelected ? 'reveal-wrong' : '',
              ].join(' ')}
              disabled={locked || !!revealedCorrectAnswer}
              onClick={() => onSelect(key)}
            >
              <span className="pf-option-key">{key}</span>
              <span className="pf-option-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
