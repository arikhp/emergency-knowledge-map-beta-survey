import type { FieldError, Path, UseFormRegister } from 'react-hook-form';
import type { FormValues } from '../types';

interface Props {
  name: Path<FormValues>;
  register: UseFormRegister<FormValues>;
  min: number;
  max: number;
  leftCaption?: string;
  rightCaption?: string;
  required?: boolean;
  error?: FieldError;
}

export function ScaleField({
  name,
  register,
  min,
  max,
  leftCaption,
  rightCaption,
  required,
  error,
}: Props) {
  const values: number[] = [];
  for (let i = min; i <= max; i++) values.push(i);

  return (
    <div className="scale-field">
      <div className="scale-options">
        {values.map((v) => (
          <label key={v} className={`scale-option${error ? ' scale-option-error' : ''}`}>
            <input type="radio" value={v} {...register(name, { required })} />
            <span>{v}</span>
          </label>
        ))}
      </div>
      {(rightCaption || leftCaption) && (
        <div className="scale-captions">
          <span>{rightCaption}</span>
          <span>{leftCaption}</span>
        </div>
      )}
      {error && <p className="field-error">שדה חובה — יש לבחור ערך</p>}
    </div>
  );
}
