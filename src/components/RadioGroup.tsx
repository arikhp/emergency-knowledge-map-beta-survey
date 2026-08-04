import type { FieldError, Path, UseFormRegister } from 'react-hook-form';
import type { FormValues } from '../types';

interface Option {
  value: string;
  label: string;
}

interface Props {
  name: Path<FormValues>;
  register: UseFormRegister<FormValues>;
  options: Option[];
  required?: boolean;
  error?: FieldError;
  inline?: boolean;
}

export function RadioGroup({ name, register, options, required, error, inline }: Props) {
  return (
    <div className={`radio-group${inline ? ' radio-group-inline' : ''}`}>
      {options.map((opt) => (
        <label key={opt.value} className="radio-option">
          <input type="radio" value={opt.value} {...register(name, { required })} />
          <span>{opt.label}</span>
        </label>
      ))}
      {error && <p className="field-error">שדה חובה — יש לבחור אפשרות</p>}
    </div>
  );
}
