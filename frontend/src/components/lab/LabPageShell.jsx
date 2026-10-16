import { IosPage } from '../mobile';

export default function LabPageShell({ children, className = '', wide = false }) {
  return (
    <IosPage>
      <div
        className={`lab-page mx-auto w-full ${
          wide ? 'lab-page--wide' : 'max-w-[1024px] md:ios-page-card'
        } ${className}`.trim()}
      >
        {children}
      </div>
    </IosPage>
  );
}
