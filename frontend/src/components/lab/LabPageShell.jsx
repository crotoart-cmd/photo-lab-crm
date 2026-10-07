import { IosPage } from '../mobile';

export default function LabPageShell({ children, className = '' }) {
  return (
    <IosPage>
      <div className={`lab-page mx-auto w-full max-w-[1024px] md:ios-page-card ${className}`.trim()}>
        {children}
      </div>
    </IosPage>
  );
}
