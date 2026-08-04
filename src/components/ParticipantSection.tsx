import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { backgroundOptions, userTypeOptions } from '../data/questionnaire';
import type { FormValues } from '../types';
import { RadioGroup } from './RadioGroup';
import { CheckboxGroup } from './CheckboxGroup';

interface Props {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function ParticipantSection({ register, errors }: Props) {
  return (
    <section className="card" id="participant">
      <h2 className="section-title">פרטי המשתתף/ת</h2>

      <div className="field">
        <label className="field-label" htmlFor="participantName">
          שם מלא <span className="required-mark">*</span>
        </label>
        <input
          id="participantName"
          type="text"
          {...register('participantName', { required: true })}
        />
        {errors.participantName && <p className="field-error">שדה חובה</p>}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="participantRole">
          תפקיד / יחידה / רשות
        </label>
        <input id="participantRole" type="text" {...register('participantRole')} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="participantDate">
          תאריך ביצוע הבדיקה
        </label>
        <input id="participantDate" type="date" {...register('participantDate')} />
      </div>

      <div className="field">
        <label className="field-label">
          סוג המשתמש במערכת <span className="required-mark">*</span>
        </label>
        <RadioGroup
          name="userType"
          register={register}
          options={userTypeOptions}
          required
          error={errors.userType}
        />
      </div>

      <div className="field">
        <label className="field-label">רקע מקצועי וניסיון</label>
        <CheckboxGroup name="background" register={register} options={backgroundOptions} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="frequency">
          תדירות שימוש צפויה במערכת (יומי / שבועי / רק בשעת חירום / אחר)
        </label>
        <input id="frequency" type="text" {...register('frequency')} />
      </div>
    </section>
  );
}
