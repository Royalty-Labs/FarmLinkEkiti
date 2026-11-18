import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Labelled = { label: string; hint?: ReactNode; optional?: boolean };

function FieldLabel({ id, label, optional }: { id: string; label: string; optional?: boolean }) {
  return (
    <label htmlFor={id} className="field__label">
      {label}
      {optional && <span className="field__optional"> (optional)</span>}
    </label>
  );
}

export function TextField({
  id,
  label,
  hint,
  optional,
  prefix,
  ...props
}: Labelled & { id: string; prefix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <FieldLabel id={id} label={label} optional={optional} />
      {prefix ? (
        <div className="input-group">
          <span className="input-group__prefix">{prefix}</span>
          <input id={id} className="input input--bare" {...props} />
        </div>
      ) : (
        <input id={id} className="input" {...props} />
      )}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

export function SelectField({
  id,
  label,
  options,
  ...props
}: Labelled & { id: string; options: { value: string; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="field">
      <FieldLabel id={id} label={label} />
      <select id={id} className="input" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  optional,
  hint,
  ...props
}: Labelled & { id: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <FieldLabel id={id} label={label} optional={optional} />
      <textarea id={id} className="input input--area" {...props} />
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}
