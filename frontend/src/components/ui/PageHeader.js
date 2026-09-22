export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-brand-strong dark:text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.035em] text-ink">
          {title}
        </h1>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

