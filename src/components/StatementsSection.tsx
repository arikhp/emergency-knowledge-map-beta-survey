import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { npsQuestion, statements } from '../data/questionnaire';
import type { FormValues } from '../types';
import { ScaleField } from './ScaleField';

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function StatementsSection({ register, errors }: Props) {
  return (
    <section className="card" id="partB">
      <h2 className="section-title">חלק ב&apos; — הערכה כללית של המערכת</h2>
      <p className="section-hint">
        דרגו את מידת הסכמתכם עם כל אחד מהמשפטים הבאים (1 = לא מסכים כלל, 5 = מסכים מאוד).
      </p>

      {statements.map((stmt, i) => (
        <div className="field statement-field" key={stmt.id}>
          <label className="field-label">
            {i + 1}. {stmt.label}
          </label>
          <ScaleField
            name={`statements.${stmt.id}`}
            register={register}
            min={1}
            max={5}
            rightCaption="1 — לא מסכים כלל"
            leftCaption="5 — מסכים מאוד"
            required
            error={errors.statements?.[stmt.id]}
          />
        </div>
      ))}

      <div className="field statement-field">
        <label className="field-label">{npsQuestion}</label>
        <ScaleField
          name="nps"
          register={register}
          min={0}
          max={10}
          rightCaption="0 — כלל לא סביר"
          leftCaption="10 — סביר מאוד"
          required
          error={errors.nps}
        />
      </div>
    </section>
  );
}
