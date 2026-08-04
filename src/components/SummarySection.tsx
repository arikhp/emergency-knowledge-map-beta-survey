import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { FormValues } from '../types';
import { ScaleField } from './ScaleField';
import { RadioGroup } from './RadioGroup';

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  submitting: boolean;
}

const followUpOptions = [
  { value: 'yes', label: 'כן' },
  { value: 'no', label: 'לא' },
];

export function SummarySection({ register, errors, submitting }: Props) {
  return (
    <section className="card" id="summary">
      <h2 className="section-title">סיכום</h2>

      <div className="field">
        <label className="field-label">
          ציון שביעות רצון כללי מהמערכת (1 = נמוך מאוד, 10 = גבוה מאוד)
        </label>
        <ScaleField
          name="summaryScore"
          register={register}
          min={1}
          max={10}
          rightCaption="1 — נמוך מאוד"
          leftCaption="10 — גבוה מאוד"
          required
          error={errors.summaryScore}
        />
      </div>

      <div className="field">
        <label className="field-label">האם תרצו להשתתף בסבב בדיקה נוסף / ראיון המשך קצר?</label>
        <RadioGroup
          name="followUp"
          register={register}
          options={followUpOptions}
          required
          error={errors.followUp}
          inline
        />
      </div>

      <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
        {submitting ? 'שולח...' : 'שליחת השאלון'}
      </button>
    </section>
  );
}
