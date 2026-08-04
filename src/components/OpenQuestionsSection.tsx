import type { UseFormRegister } from 'react-hook-form';
import { openQuestions } from '../data/questionnaire';
import type { FormValues } from '../types';

interface Props {
  register: UseFormRegister<FormValues>;
}

export function OpenQuestionsSection({ register }: Props) {
  return (
    <section className="card" id="partC">
      <h2 className="section-title">חלק ג&apos; — שאלות פתוחות: זיהוי צרכים ומגמות</h2>
      <p className="section-hint">
        החלק הזה הוא הלב של הבדיקה. המטרה היא לזהות פיצ&apos;רים, שכבות מידע או תרחישים שלא
        חשבנו עליהם. אנא הרחיבו ככל האפשר — דוגמאות קונקרטיות שוות יותר מתיאורים כלליים.
      </p>

      {openQuestions.map((q, i) => (
        <div className="field" key={q.id}>
          <label className="field-label" htmlFor={q.id}>
            {i + 1}. {q.label}
          </label>
          <textarea id={q.id} rows={4} {...register(`open.${q.id}`)} />
        </div>
      ))}
    </section>
  );
}
