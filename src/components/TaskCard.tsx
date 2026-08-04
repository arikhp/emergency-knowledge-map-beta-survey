import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { Task } from '../data/questionnaire';
import { completionOptions } from '../data/questionnaire';
import type { FormValues } from '../types';
import { ScaleField } from './ScaleField';
import { RadioGroup } from './RadioGroup';

interface Props {
  task: Task;
  index: number;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function TaskCard({ task, index, register, errors }: Props) {
  const taskErrors = errors.tasks?.[task.id];

  return (
    <div className="card task-card" id={task.id}>
      <h3 className="task-title">
        <span className="task-number">{index + 1}</span>
        {task.title}
      </h3>
      <ol className="task-steps">
        {task.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {task.tip && (
        <p className="tip">
          <span aria-hidden="true">💡</span> {task.tip}
        </p>
      )}

      <div className="field">
        <label className="field-label">מידת הקלות בביצוע המשימה</label>
        <ScaleField
          name={`tasks.${task.id}.ease`}
          register={register}
          min={1}
          max={5}
          rightCaption="1 — לא מסכים כלל"
          leftCaption="5 — מסכים מאוד"
          required
          error={taskErrors?.ease}
        />
      </div>

      <div className="field">
        <label className="field-label">האם הצלחת להשלים את המשימה?</label>
        <RadioGroup
          name={`tasks.${task.id}.completion`}
          register={register}
          options={completionOptions}
          required
          error={taskErrors?.completion}
          inline
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${task.id}-notes`}>
          הערות / קשיים שנתקלת בהם במשימה זו
        </label>
        <textarea
          id={`${task.id}-notes`}
          rows={3}
          {...register(`tasks.${task.id}.notes`)}
        />
      </div>
    </div>
  );
}
