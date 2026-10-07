export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className="mb-4 md:mb-8 flex flex-wrap items-end justify-between gap-3 md:gap-4">
      <div className="min-w-0">
        <h1 className="apple-page-title">{title}</h1>
        {subtitle && <p className="apple-page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 w-full md:w-auto">{children}</div>}
    </header>
  );
}
