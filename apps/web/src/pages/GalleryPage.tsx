import { GuestAliasSchema, type PhotoItemDto, WEDDING_CONFIG } from '@wedding/shared';
import { Camera, ImagePlus, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoLightbox, formatRelativeTime } from '../components/PhotoLightbox.js';
import {
  BottomSheet,
  EditorialDivider,
  MobileShell,
  PillButton,
  SurfaceCard,
  WeddingHeader,
} from '../components/ui/index.js';
import { useSession } from '../context/SessionContext.js';
import {
  deletePhotoById,
  fetchPhotos,
  uploadPhotosWithProgress,
} from '../lib/api.js';
import { compressImagesForUpload } from '../lib/image-compression.js';

export function GalleryPage() {
  const navigate = useNavigate();
  const { session, saveAlias, setLocalAlias } = useSession();

  const [photos, setPhotos] = useState<PhotoItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingNewPhotos, setPendingNewPhotos] = useState<PhotoItemDto[] | null>(
    null,
  );
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItemDto | null>(null);

  // Onboarding de nombre + selector de subida
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [draftAlias, setDraftAlias] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  // Estado de compresión, envío y reintento en 4G
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryFiles, setRetryFiles] = useState<File[] | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAliasRef = useRef<string | null>(null);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetchPhotos('general', 'recent');
      setPhotos(res.photos);
      setPendingNewPhotos(null);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No pudimos conectar con el servidor de fotos. Verificá que la API esté corriendo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  // Polling liviano cada 20s solo cuando la pestaña está visible
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || uploadingStage) return;
      fetchPhotos('general', 'recent')
        .then((res) => {
          const newestServerId = res.photos[0]?.id;
          const newestLocalId = photos[0]?.id;
          if (
            newestServerId &&
            newestServerId !== newestLocalId &&
            res.photos.length >= photos.length
          ) {
            setPendingNewPhotos(res.photos);
          }
        })
        .catch(() => {
          // Ignorar fallos silenciosos de polling
        });
    }, WEDDING_CONFIG.polling.intervalMs);

    return () => window.clearInterval(timer);
  }, [photos, uploadingStage]);

  const executeUpload = async (rawOrCompressedFiles: File[], alreadyCompressed = false) => {
    setUploadError(null);
    setUploadPercent(0);

    try {
      let prepared = rawOrCompressedFiles;
      if (!alreadyCompressed) {
        setUploadingStage(`Optimizando ${rawOrCompressedFiles.length} foto(s)...`);
        prepared = await compressImagesForUpload(
          rawOrCompressedFiles,
          (done, total) => {
            setUploadingStage(`Optimizando fotos (${done}/${total})...`);
          },
        );
      }

      setRetryFiles(prepared);
      setUploadingStage('Subiendo al Álbum General...');

      const effectiveAlias = pendingAliasRef.current ?? session.alias ?? undefined;
      const result = await uploadPhotosWithProgress({
        section: 'general',
        files: prepared,
        alias: effectiveAlias,
        onProgress: (pct) => setUploadPercent(pct),
      });

      if (effectiveAlias && !session.alias) {
        setLocalAlias(effectiveAlias);
      }
      pendingAliasRef.current = null;
      setRetryFiles(null);
      setUploadingStage(null);
      setUploadSheetOpen(false);

      // Insertar fotos recién subidas al principio de la grilla al instante
      setPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const fresh = result.photos.filter((p) => !existingIds.has(p.id));
        return [...fresh, ...prev];
      });
    } catch (err) {
      setUploadingStage(null);
      setUploadError(
        err instanceof Error
          ? err.message
          : 'No pudimos subir las fotos. Tocá reintentar.',
      );
    }
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const picked = Array.from(fileList).slice(
      0,
      WEDDING_CONFIG.limits.maxBatchUploadGeneral,
    );
    // Limpiar input para permitir volver a elegir la misma foto si quiere
    event.target.value = '';
    void executeUpload(picked, false);
  };

  /**
   * Abre el selector nativo de Galería o Cámara manteniendo la cadena sincrónica
   * del clic para compatibilidad total con iOS Safari y Android Chrome.
   */
  const triggerPicker = (mode: 'gallery' | 'camera') => {
    setAliasError(null);

    if (!session.alias) {
      const parsed = GuestAliasSchema.safeParse(draftAlias);
      if (!parsed.success) {
        setAliasError(
          parsed.error.issues[0]?.message ?? 'Escribí tu nombre primero.',
        );
        return;
      }
      pendingAliasRef.current = parsed.data;
      // Guardamos en segundo plano mientras el usuario elige fotos de su galería
      void saveAlias(parsed.data).catch(() => {});
    }

    if (mode === 'camera') {
      cameraInputRef.current?.click();
    } else {
      galleryInputRef.current?.click();
    }
  };

  const handlePrimaryUploadTap = () => {
    setUploadError(null);
    if (session.alias) {
      // Si ya sabemos quién es, abrimos el sheet con Galería / Cámara directo o abrimos galería
      setUploadSheetOpen(true);
    } else {
      setDraftAlias('');
      setAliasError(null);
      setUploadSheetOpen(true);
    }
  };

  const handleDeletePhoto = async (photo: PhotoItemDto) => {
    await deletePhotoById(photo.id);
    setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
  };

  const isLive = session.eventMode === 'live';

  return (
    <MobileShell className="pb-24">
      <WeddingHeader
        variant="subroute"
        eyebrow="Fotos compartidas"
        title="Álbum General"
        countLabel={
          photos.length > 0 ? `${photos.length} foto(s) compartidas` : undefined
        }
      />

      {photos.length > 0 ? (
        <div className="mb-3.5 flex justify-end">
          <PillButton
            variant="secondary"
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            onClick={() => navigate('/presentacion?seccion=general')}
            className="min-h-[42px] px-4 py-2 text-[13px]"
          >
            Presentación
          </PillButton>
        </div>
      ) : null}

      {/* Inputs nativos accesibles para Galería (múltiple) y Cámara directa */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        onChange={handleFilesSelected}
        className="sr-only"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        className="sr-only"
      />

      {/* Pildorita de fotos nuevas (Polling cada 20s sin saltos de scroll) */}
      {pendingNewPhotos ? (
        <div className="sticky top-3 z-20 mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setPhotos(pendingNewPhotos);
              setPendingNewPhotos(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2 font-sans text-[13px] font-medium text-white shadow-lg transition active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>Hay fotos nuevas · Tocá para ver</span>
          </button>
        </div>
      ) : null}

      {/* Banner de progreso o reintento si la subida ocurre en pantalla */}
      {uploadingStage ? (
        <SurfaceCard className="mb-4 p-4">
          <div className="flex items-center justify-between gap-2 font-sans text-[13px] font-medium text-ink">
            <span>{uploadingStage}</span>
            {uploadPercent > 0 ? <span>{uploadPercent}%</span> : null}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-ink transition-all duration-200"
              style={{ width: `${Math.max(12, uploadPercent)}%` }}
            />
          </div>
        </SurfaceCard>
      ) : null}

      {uploadError ? (
        <SurfaceCard className="mb-4 border-danger/40 p-4">
          <p className="font-sans text-[13px] text-danger">{uploadError}</p>
          {retryFiles ? (
            <div className="mt-3">
              <PillButton
                fullWidth
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={() => void executeUpload(retryFiles, true)}
              >
                Reintentar subida
              </PillButton>
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      {/* Contenido Principal: Skeletons, Estado Vacío o Grilla 2 Columnas */}
      {loading ? (
        <div className="grid grid-cols-2 gap-[10px]">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="aspect-[4/5] animate-pulse rounded-[16px] border border-line bg-paper"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <SurfaceCard className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas text-accent">
            <Camera className="h-5 w-5" />
          </div>

          <h2 className="mt-4 font-serif text-[26px] leading-[1.15] font-medium text-ink">
            Estrená el Álbum General
          </h2>

          <p className="mx-auto mt-2 max-w-[300px] font-serif text-[20px] leading-[1.35] text-muted italic">
            Sé de las primeras personas en subir postales del civil y el brunch de Joa
            &amp; Maga.
          </p>

          <EditorialDivider className="my-5" />

          <p className="font-sans text-[13px] text-muted">
            Elegí hasta {WEDDING_CONFIG.limits.maxBatchUploadGeneral} fotos juntas de
            tu galería o sacá una en el momento.
          </p>

          {isLive ? (
            <div className="mt-5">
              <PillButton
                fullWidth
                icon={<ImagePlus className="h-4 w-4" />}
                onClick={handlePrimaryUploadTap}
              >
                Subir fotos
              </PillButton>
            </div>
          ) : null}
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-2 gap-[10px]">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="group relative flex aspect-[4/5] cursor-pointer flex-col justify-end overflow-hidden rounded-[16px] border border-line bg-paper p-0 text-left transition active:scale-[0.99]"
            >
              <img
                src={photo.thumbUrl}
                alt={`Foto subida por ${photo.authorAlias}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-2.5 pt-8 pb-2 text-white">
                <p className="truncate font-sans text-[12px] font-medium">
                  {photo.authorAlias}
                </p>
                <p className="font-sans text-[10px] text-white/80">
                  {formatRelativeTime(photo.createdAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Botón flotante inferior al alcance del pulgar */}
      {isLive && photos.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
          <PillButton
            fullWidth
            icon={<ImagePlus className="h-4 w-4" />}
            onClick={handlePrimaryUploadTap}
            className="shadow-[0_12px_28px_rgba(47,43,39,0.28)]"
          >
            Subir fotos
          </PillButton>
        </div>
      ) : null}

      {/* BottomSheet unificado: pide nombre solo la 1ª vez y abre Galería o Cámara */}
      <BottomSheet
        open={uploadSheetOpen}
        onClose={() => {
          if (!uploadingStage) setUploadSheetOpen(false);
        }}
        title={session.alias ? 'Subir al Álbum General' : '¿Cómo te llamás?'}
        subtitle={
          session.alias
            ? `Podés seleccionar hasta ${WEDDING_CONFIG.limits.maxBatchUploadGeneral} fotos juntas desde tu teléfono.`
            : 'Escribí tu nombre una sola vez y elegí las fotos de tu celular.'
        }
      >
        <div className="flex flex-col gap-3.5">
          {!session.alias ? (
            <div>
              <input
                type="text"
                value={draftAlias}
                onChange={(e) => {
                  setDraftAlias(e.target.value);
                  if (aliasError) setAliasError(null);
                }}
                placeholder="Ej: Sofi, Tío Carlos, Mesa 4..."
                maxLength={WEDDING_CONFIG.limits.maxAliasLength}
                autoFocus
                className="w-full rounded-[14px] border border-line bg-white px-4 py-[15px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
              {aliasError ? (
                <p className="mt-1.5 font-sans text-[13px] text-danger">
                  {aliasError}
                </p>
              ) : null}
            </div>
          ) : null}

          <PillButton
            type="button"
            fullWidth
            disabled={Boolean(uploadingStage)}
            icon={<ImagePlus className="h-4 w-4" />}
            onClick={() => triggerPicker('gallery')}
          >
            Elegir de Galería / Fotos
          </PillButton>

          <PillButton
            type="button"
            variant="secondary"
            fullWidth
            disabled={Boolean(uploadingStage)}
            icon={<Camera className="h-4 w-4" />}
            onClick={() => triggerPicker('camera')}
          >
            Sacar foto con Cámara
          </PillButton>
        </div>
      </BottomSheet>

      <PhotoLightbox
        photo={selectedPhoto}
        canDelete={Boolean(
          selectedPhoto && (selectedPhoto.isOwnPhoto || session.isModerator),
        )}
        onClose={() => setSelectedPhoto(null)}
        onDelete={handleDeletePhoto}
      />
    </MobileShell>
  );
}
