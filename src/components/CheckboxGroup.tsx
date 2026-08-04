import type { Path, UseFormRegister } from 'react-hook-form';
import type { FormValues } from '../types';

interface Option {
  value: string;
  label: string;
}

interface Props {
  name: Path<FormValues>;
  register: UseFormRegister<FormValues>;
  options: Option[];
}

export function CheckboxGroup({ name, register, options }: Props) {
  return (
    <div className="checkbox-group">
      {options.map((opt) => (
        <label key={opt.value} className="checkbox-option">
          <input type="checkbox" value={opt.value} {...register(name)} />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
