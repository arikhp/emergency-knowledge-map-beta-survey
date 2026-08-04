import { forwardRef } from 'react';
import logo from './assets/logo.png';
import {
  backgroundOptions,
  completionOptions,
  meta,
  npsQuestion,
  openQuestions,
  statements,
  tasks,
} from './data/questionnaire';
import type { FormValues } from './types';

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? (value ? value : '—');
}

function displayValue(value: string | undefined): string {
  return value && value.trim() !== '' ? value : '—';
}

interface Props {
  values: FormValues;
}

export const ReviewView = forwardRef<HTMLDivElement, Props>(function ReviewView(
  { values },
  ref,
) {
  return (
    <div className="review-view" ref={ref}>
      <header className="review-header">
        <img src={logo} alt="" className="review-logo" />
        <div>
          <h1>{meta.title}</h1>
          <h2>{meta.subtitle}</h2>
        </div>
      </header>

      <section className="review-section">
        <h3>פרטי המשתתף/ת</h3>
        <dl>
          <dt>שם מלא</dt>
          <dd>{displayValue(values.participantName)}</dd>
          <dt>תפקיד / יחידה / רשות</dt>
          <dd>{displayValue(values.participantRole)}</dd>
          <dt>תאריך ביצוע הבדיקה</dt>
          <dd>{displayValue(values.participantDate)}</dd>
          <dt>רקע מקצועי וניסיון</dt>
          <dd>
            {values.background && values.background.length > 0
              ? values.background.map((v) => labelFor(backgroundOptions, v)).join(' · ')
              : '—'}
          </dd>
          <dt>תדירות שימוש צפויה</dt>
          <dd>{displayValue(values.frequency)}</dd>
        </dl>
      </section>

      <section className="review-section">
        <h3>חלק א&apos; — משימות מודרכות</h3>
        {tasks.map((task) => {
          const answer = values.tasks?.[task.id];
          return (
            <div className="review-item" key={task.id}>
              <p className="review-question">{task.title}</p>
              <dl>
                <dt>מידת הקלות (1–5)</dt>
                <dd>{displayValue(answer?.ease)}</dd>
                <dt>הצלחה בביצוע</dt>
                <dd>{labelFor(completionOptions, answer?.completion ?? '')}</dd>
                <dt>הערות</dt>
                <dd>{displayValue(answer?.notes)}</dd>
              </dl>
            </div>
          );
        })}
      </section>

      <section className="review-section">
        <h3>חלק ב&apos; — הערכה כללית של המערכת</h3>
        {statements.map((stmt, i) => (
          <div className="review-item" key={stmt.id}>
            <p className="review-question">
              {i + 1}. {stmt.label}
            </p>
            <p className="review-answer">{displayValue(values.statements?.[stmt.id])}</p>
          </div>
        ))}
        <div className="review-item">
          <p className="review-question">{npsQuestion}</p>
          <p className="review-answer">{displayValue(values.nps)}</p>
        </div>
      </section>

      <section className="review-section">
        <h3>חלק ג&apos; — שאלות פתוחות</h3>
        {openQuestions.map((q, i) => (
          <div className="review-item" key={q.id}>
            <p className="review-question">
              {i + 1}. {q.label}
            </p>
            <p className="review-answer">{displayValue(values.open?.[q.id])}</p>
          </div>
        ))}
      </section>

      <section className="review-section">
        <h3>סיכום</h3>
        <dl>
          <dt>ציון שביעות רצון כללי (1–10)</dt>
          <dd>{displayValue(values.summaryScore)}</dd>
          <dt>השתתפות בסבב בדיקה נוסף</dt>
          <dd>{values.followUp === 'yes' ? 'כן' : values.followUp === 'no' ? 'לא' : '—'}</dd>
        </dl>
      </section>

      <footer className="review-footer">
        <p>{meta.thankYou}</p>
      </footer>
    </div>
  );
});
