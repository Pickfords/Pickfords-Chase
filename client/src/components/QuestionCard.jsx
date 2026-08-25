import './questioncard.css';

export default function QuestionCard({ question, selectedAnswer, onSelect, locked, revealedCorrectAnswer, outlineAnswer }) {
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
          const label = question.options?.[key];
          if (!label) return null;
          const isSelected = selectedAnswer === key;
          const isRevealCorrect = revealedCorrectAnswer && key === revealedCorrectAnswer;
          const isRevealWrongSelected = revealedCorrectAnswer && isSelected && key !== revealedCorrectAnswer;
          // Obvious fill change the instant the player locks in (before reveal) -
          // distinct from the subtler hover/selected tint used while still choosing.
          const isLockedIn = isSelected && locked && !revealedCorrectAnswer;
          // Red outline on whichever option the Chaser picked, once revealed -
          // independent of the correct/incorrect fill, which still applies too.
          const isOutlined = revealedCorrectAnswer && outlineAnswer && key === outlineAnswer;
          return (
            <button
              key={key}
              type="button"
              className={[
                'pf-option',
                isSelected ? 'selected' : '',
                isLockedIn ? 'locked-in' : '',
                isRevealCorrect ? 'reveal-correct' : '',
                isRevealWrongSelected ? 'reveal-wrong' : '',
                isOutlined ? 'outline-red' : '',
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
