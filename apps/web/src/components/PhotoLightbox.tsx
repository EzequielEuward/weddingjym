import type { PhotoItemDto } from '@wedding/shared';
import { Download, Heart, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PillButton } from './ui/index.js';

export interface PhotoLightboxProps {
  photo: PhotoItemDto | null;
  canDelete: boolean;
  onClose: () => void;
  onDelete?: (photo: PhotoItemDto) => Promise<void>;
  onToggleVote?: (photo: PhotoItemDto) => void;
}

export function formatRelativeTime(isoString: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 45) return 'recién';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  return new Date(isoString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function PhotoLightbox({
  photo,
  canDelete,
  onClose,
  onDelete,
  onToggleVote,
}: PhotoLightboxProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
    setDeleting(false);
  }, [photo?.id]);

  useEffect(() => {
    if (!photo) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [photo, onClose]);

  if (!photo) return null;

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(photo);
      onClose();
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto subida por ${photo.authorAlias}`}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-ink/92 p-3.5 text-white backdrop-blur-xs"
    >
      {/* Barra superior */}
      <div className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-sans text-[14px] font-medium text-white">
            {photo.authorAlias}
          </p>
          <p className="font-sans text-[12px] text-white/70">
            {formatRelativeTime(photo.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar vista ampliada"
          className="inline-flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Imagen principal */}
      <div
        className="mx-auto my-2 flex min-h-0 w-full max-w-[480px] flex-1 flex-col items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={photo.fullUrl}
          alt={photo.caption ?? `Foto de ${photo.authorAlias}`}
          className="max-h-[70dvh] w-auto max-w-full rounded-[18px] object-contain shadow-2xl"
        />
        {photo.caption ? (
          <p className="mt-3 max-w-full text-center font-serif text-[20px] leading-snug text-white/95 italic">
            “{photo.caption}”
          </p>
        ) : null}
      </div>

      {/* Acciones inferiores */}
      <div className="mx-auto w-full max-w-[480px] pb-[max(8px,env(safe-area-inset-bottom))]">
        {confirmingDelete ? (
          <div className="rounded-[20px] border border-line bg-paper p-4 text-ink">
            <p className="text-center font-sans text-[14px] font-medium">
              ¿Querés eliminar esta foto del álbum?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <PillButton
                variant="secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancelar
              </PillButton>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full bg-danger px-4 font-sans text-[14px] font-medium text-white transition active:scale-98 disabled:opacity-50"
              >
                {deleting ? 'Borrando...' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5">
            {photo.section !== 'general' && onToggleVote ? (
              <button
                type="button"
                onClick={() => onToggleVote(photo)}
                className={`inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border px-4 font-sans text-[14px] font-medium transition active:scale-95 ${
                  photo.votedByMe
                    ? 'border-vote bg-vote text-white'
                    : 'border-white/25 bg-white/10 text-white'
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${photo.votedByMe ? 'fill-current' : ''}`}
                />
                <span>{photo.voteCount}</span>
              </button>
            ) : null}

            <a
              href={photo.fullUrl}
              download={`joa-y-maga-${photo.id.slice(0, 8)}.webp`}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-paper px-5 font-sans text-[14px] font-medium text-ink no-underline transition active:scale-98"
            >
              <Download className="h-4 w-4" />
              <span>Descargar foto</span>
            </a>

            {canDelete && onDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Eliminar foto"
                className="inline-flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-danger active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
