import { WEDDING_CONFIG } from '@wedding/shared';
import { QrCode, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  EditorialDivider,
  MobileShell,
  SurfaceCard,
  WeddingHeader,
} from './ui/index.js';

export function QrGateScreen() {
  return (
    <MobileShell>
      <WeddingHeader variant="home" />
      <EditorialDivider className="my-5" />

      <SurfaceCard className="p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-canvas text-accent">
          <QrCode className="h-6 w-6" />
        </div>

        <h2 className="mt-4 font-serif text-[28px] leading-tight font-medium text-ink">
          Acceso exclusivo para invitados
        </h2>

        <p className="mx-auto mt-2.5 max-w-[300px] font-sans text-[14px] leading-relaxed text-muted">
          Para ver y compartir fotos del casamiento de {WEDDING_CONFIG.titleDisplay},
          escaneá con tu cámara el código QR ubicado en las mesas del salón.
        </p>
      </SurfaceCard>

      <footer className="mt-auto pt-8 text-center">
        <Link
          to="/moderador"
          className="inline-flex min-h-[48px] items-center gap-1.5 px-3 font-sans text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Acceso organización</span>
        </Link>
      </footer>
    </MobileShell>
  );
}
