import {
  GuestAliasSchema,
  WEDDING_CONFIG,
  type PhotoItemDto,
  type PhotoSort,
} from '@wedding/shared';
import {
  Camera,
  Clock,
  Heart,
  ImagePlus,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoLightbox } from '../components/PhotoLightbox.js';
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
  ApiClientError,
  deletePhotoById,
  fetchPhotos,
  togglePhotoVote,
  uploadPhotosWithProgress,
} from '../lib/api.js';
import { compressImagesForUpload } from '../lib/image-compression.js';

type UploadStage = 'idle' | 'compressing' | 'uploading' | 'failed';

export function BestOutfitPage() {
  const navigate = useNavigate();
  const { session, saveAlias, setLocalAlias } = useSession();

  const [activeTab, setActiveTab] = useState<PhotoSort>('recent');
  const [photos, setPhotos] = useState<PhotoItemDto[]>([]);
  const [myEntryCount, setMyEntryCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Polling suave cada 20s
  const [pendingFreshPhotos, setPendingFreshPhotos] = useState<
    PhotoItemDto[] | null
  >(null);
  const [pendingMyEntryCount, setPendingMyEntryCount] = useState<number | null>(
    null,
  );

  // Lightbox
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Subida contextual de 1 look + preview + reintento sin recomprimir
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [rawSelectedFile, setRawSelectedFile] = useState<File | null>(null);
  const [compressedFileReady, setCompressedFileReady] = useState<File | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [inlineAlias, setInlineAlias] = useState('');
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Onboarding diferido de Apodo al tocar ❤️ por primera vez
  const [voteAliasSheetOpen, setVoteAliasSheetOpen] = useState(false);
  const [voteDraftAlias, setVoteDraftAlias] = useState('');
  const [voteAliasError, setVoteAliasError] = useState<string | null>(null);
  const [savingVoteAlias, setSavingVoteAlias] = useState(false);
  const [pendingVotePhotoId, setPendingVotePhotoId] = useState<string | null>(
    null,
  );
  const [votingIds, setVotingIds] = useState<Set<string>>(() => new Set());

  const isLive = session.eventMode === 'live';
  const maxEntries = WEDDING_CONFIG.limits.maxEntriesPerContestSession;
  const remainingSlots = Math.max(0, maxEntries - myEntryCount);

  const selectedPhoto =
    selectedPhotoId !== null
      ? (photos.find((item) => item.id === selectedPhotoId) ?? null)
      : null;

  const loadContestPhotos = useCallback(
    async (sort: PhotoSort, showSpinner = false) => {
      if (showSpinner) {
        setInitialLoading(true);
      }
      try {
        const response = await fetchPhotos('best_outfit', sort);
        setPhotos(response.photos);
        setMyEntryCount(response.myContestEntryCount);
        setPendingFreshPhotos(null);
        setPendingMyEntryCount(null);
        setErrorBanner(null);
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'No pudimos cargar los looks en este momento.';
        setErrorBanner(message);
      } finally {
        setInitialLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadContestPhotos(activeTab, true);
  }, [activeTab, loadContestPhotos]);

  // Polling liviano cada 20s cuando la pestaña está visible en "Recientes"
  useEffect(() => {
    if (activeTab !== 'recent') {
      return;
    }

    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      try {
        const latest = await fetchPhotos('best_outfit', 'recent');
        const currentFirstId = photos[0]?.id;
        const latestFirstId = latest.photos[0]?.id;

        if (
          latestFirstId &&
          (latestFirstId !== currentFirstId ||
            latest.photos.length > photos.length)
        ) {
          setPendingFreshPhotos(latest.photos);
          setPendingMyEntryCount(latest.myContestEntryCount);
        }
      } catch {
        // Silencioso durante polling en segundo plano
      }
    }, WEDDING_CONFIG.polling.intervalMs);

    return () => window.clearInterval(timer);
  }, [activeTab, photos]);

  // Limpieza de ObjectURL del preview local
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const applyPendingFreshPhotos = () => {
    if (!pendingFreshPhotos) return;
    setPhotos(pendingFreshPhotos);
    if (pendingMyEntryCount !== null) {
      setMyEntryCount(pendingMyEntryCount);
    }
    setPendingFreshPhotos(null);
    setPendingMyEntryCount(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetEntryDraft = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRawSelectedFile(null);
    setCompressedFileReady(null);
    setPreviewUrl(null);
    setCaption('');
    setUploadStage('idle');
    setUploadProgress(0);
    setUploadError(null);
  };

  const handleOpenPicker = () => {
    if (!isLive || remainingSlots <= 0) return;
    setUploadError(null);
    if (session.alias && !inlineAlias) {
      setInlineAlias(session.alias);
    }
    setEntrySheetOpen(true);
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const nextPreview = URL.createObjectURL(picked);
    setRawSelectedFile(picked);
    setCompressedFileReady(null);
    setPreviewUrl(nextPreview);
    setUploadStage('idle');
    setUploadProgress(0);
    setUploadError(null);
    if (session.alias && !inlineAlias) {
      setInlineAlias(session.alias);
    }
    setEntrySheetOpen(true);
  };

  const handlePublishEntry = async () => {
    if (!rawSelectedFile && !compressedFileReady) {
      setUploadError('Elegí una foto de tu celular antes de publicar.');
      return;
    }

    const effectiveAlias = session.alias ?? inlineAlias.trim();
    const aliasValidation = GuestAliasSchema.safeParse(effectiveAlias);
    if (!aliasValidation.success) {
      setUploadError(
        aliasValidation.error.issues[0]?.message ??
          'Contanos tu nombre (al menos 2 letras).',
      );
      return;
    }

    setUploadError(null);

    try {
      let fileToSend = compressedFileReady;
      if (!fileToSend && rawSelectedFile) {
        setUploadStage('compressing');
        setUploadProgress(15);
        const compressedList = await compressImagesForUpload([rawSelectedFile]);
        fileToSend = compressedList[0] ?? rawSelectedFile;
        setCompressedFileReady(fileToSend);
      }

      if (!fileToSend) {
        return;
      }

      setUploadStage('uploading');
      setUploadProgress(25);

      const result = await uploadPhotosWithProgress({
        section: 'best_outfit',
        files: [fileToSend],
        caption: caption.trim() || undefined,
        alias: session.alias ? undefined : aliasValidation.data,
        onProgress: (pct) => setUploadProgress(Math.max(25, pct)),
      });

      if (!session.alias) {
        setLocalAlias(aliasValidation.data);
      }

      const uploadedPhoto = result.photos[0];
      if (uploadedPhoto) {
        setPhotos((prev) => {
          const withoutDup = prev.filter((p) => p.id !== uploadedPhoto.id);
          if (activeTab === 'top') {
            return [...withoutDup, uploadedPhoto].sort(
              (a, b) =>
                b.voteCount - a.voteCount ||
                b.createdAt.localeCompare(a.createdAt),
            );
          }
          return [uploadedPhoto, ...withoutDup];
        });
        setMyEntryCount((prev) => prev + 1);
      }

      setEntrySheetOpen(false);
      resetEntryDraft();
    } catch (err) {
      setUploadStage('failed');
      setUploadError(
        err instanceof ApiClientError
          ? err.message
          : 'Se cortó la señal al subir tu look. Tocá reintentar.',
      );
    }
  };

  const executeVoteToggle = useCallback(
    async (photoId: string) => {
      if (votingIds.has(photoId)) return;

      const target = photos.find((item) => item.id === photoId);
      if (!target) return;

      const optimisticVoted = !target.votedByMe;
      const optimisticCount = Math.max(
        0,
        target.voteCount + (optimisticVoted ? 1 : -1),
      );

      setVotingIds((prev) => new Set(prev).add(photoId));
      setErrorBanner(null);

      // Actualización optimista instantánea
      setPhotos((prev) => {
        const updated = prev.map((item) =>
          item.id === photoId
            ? {
                ...item,
                votedByMe: optimisticVoted,
                voteCount: optimisticCount,
              }
            : item,
        );
        if (activeTab === 'top') {
          return [...updated].sort(
            (a, b) =>
              b.voteCount - a.voteCount ||
              b.createdAt.localeCompare(a.createdAt),
          );
        }
        return updated;
      });

      try {
        const confirmed = await togglePhotoVote(photoId);
        setPhotos((prev) => {
          const synced = prev.map((item) =>
            item.id === photoId
              ? {
                  ...item,
                  votedByMe: confirmed.votedByMe,
                  voteCount: confirmed.voteCount,
                }
              : item,
          );
          if (activeTab === 'top') {
            return [...synced].sort(
              (a, b) =>
                b.voteCount - a.voteCount ||
                b.createdAt.localeCompare(a.createdAt),
            );
          }
          return synced;
        });
      } catch (err) {
        // Rollback en caso de error de red o sesión
        setPhotos((prev) =>
          prev.map((item) =>
            item.id === photoId
              ? {
                  ...item,
                  votedByMe: target.votedByMe,
                  voteCount: target.voteCount,
                }
              : item,
          ),
        );

        if (err instanceof ApiClientError && err.code === 'ALIAS_REQUIRED') {
          setPendingVotePhotoId(photoId);
          setVoteAliasSheetOpen(true);
        } else {
          setErrorBanner(
            err instanceof ApiClientError
              ? err.message
              : 'No pudimos registrar tu voto. Intentá de nuevo.',
          );
        }
      } finally {
        setVotingIds((prev) => {
          const next = new Set(prev);
          next.delete(photoId);
          return next;
        });
      }
    },
    [activeTab, photos, votingIds],
  );

  const handleHeartClick = (photo: PhotoItemDto) => {
    if (!isLive) {
      setErrorBanner('La votación ya cerró, pero podés mirar el ranking final.');
      return;
    }

    if (!session.alias) {
      setPendingVotePhotoId(photo.id);
      setVoteAliasError(null);
      setVoteAliasSheetOpen(true);
      return;
    }

    void executeVoteToggle(photo.id);
  };

  const handleSaveVoteAliasAndVote = async () => {
    const parsed = GuestAliasSchema.safeParse(voteDraftAlias);
    if (!parsed.success) {
      setVoteAliasError(
        parsed.error.issues[0]?.message ?? 'Ingresá tu nombre o apodo.',
      );
      return;
    }

    setSavingVoteAlias(true);
    setVoteAliasError(null);
    try {
      await saveAlias(parsed.data);
      setVoteAliasSheetOpen(false);
      const targetId = pendingVotePhotoId;
      setPendingVotePhotoId(null);
      if (targetId) {
        await executeVoteToggle(targetId);
      }
    } catch (err) {
      setVoteAliasError(
        err instanceof ApiClientError
          ? err.message
          : 'No pudimos guardar tu nombre. Intentá de nuevo.',
      );
    } finally {
      setSavingVoteAlias(false);
    }
  };

  const handleDeletePhoto = async (photo: PhotoItemDto) => {
    await deletePhotoById(photo.id);
    setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
    if (photo.isOwnPhoto) {
      setMyEntryCount((prev) => Math.max(0, prev - 1));
    }
  };

  const isBusyUploading =
    uploadStage === 'compressing' || uploadStage === 'uploading';

  return (
    <MobileShell>
      <WeddingHeader
        variant="subroute"
        eyebrow={`Competencia · ${WEDDING_CONFIG.dressCode}`}
        title="Best Outfit"
        countLabel={
          photos.length > 0
            ? `${photos.length} ${photos.length === 1 ? 'look postulado' : 'looks postulados'}`
            : `Hasta ${maxEntries} looks por celular`
        }
      />

      {photos.length > 0 ? (
        <div className="mb-3.5 flex justify-end">
          <PillButton
            variant="secondary"
            icon={<Play className="h-3.5 w-3.5 fill-current" />}
            onClick={() => navigate('/presentacion?seccion=best_outfit')}
            className="min-h-[42px] px-4 py-2 text-[13px]"
          >
            Presentación
          </PillButton>
        </div>
      ) : null}

      {/* Input nativo accesible para abrir Cámara o Galería directamente */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileSelected}
        className="sr-only"
      />

      {/* Aviso de modo solo lectura / cerrado */}
      {!isLive ? (
        <div className="mb-3.5 rounded-[18px] border border-line bg-paper px-4 py-3 text-center font-sans text-[13px] text-muted">
          La competencia ya cerró las postulaciones y votos. Podés recorrer el
          ranking final y descargar tus looks favoritos.
        </div>
      ) : null}

      {/* Barra superior de acción para postular */}
      {isLive ? (
        <SurfaceCard className="mb-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-[21px] leading-tight font-medium text-ink">
                Mostrá tu look en Aldeano
              </p>
              <p className="mt-0.5 font-sans text-[12px] text-muted">
                {remainingSlots > 0
                  ? `Te ${remainingSlots === 1 ? 'queda 1 cupo disponible' : `quedan ${remainingSlots} cupos disponibles`} en este celu.`
                  : `Ya usaste tus ${maxEntries} postulaciones (borrá una propia si querés cambiarla).`}
              </p>
            </div>

            <PillButton
              onClick={handleOpenPicker}
              disabled={remainingSlots <= 0}
              icon={<Camera className="h-4 w-4" />}
              className="shrink-0 px-4"
            >
              Postular
            </PillButton>
          </div>
        </SurfaceCard>
      ) : null}

      {/* Pestañas táctiles >= 48px: Recientes (por defecto) y Top Ranking */}
      <div
        role="tablist"
        aria-label="Orden de postulaciones"
        className="mb-4 grid grid-cols-2 gap-2 rounded-full border border-line bg-paper p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
          className={`inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-sans text-[14px] font-medium transition ${
            activeTab === 'recent'
              ? 'bg-ink text-white'
              : 'bg-transparent text-muted hover:text-ink'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Recientes</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'top'}
          onClick={() => setActiveTab('top')}
          className={`inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-sans text-[14px] font-medium transition ${
            activeTab === 'top'
              ? 'bg-ink text-white'
              : 'bg-transparent text-muted hover:text-ink'
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Top Ranking</span>
        </button>
      </div>

      {/* Píldora suave de nuevos looks por polling */}
      {pendingFreshPhotos ? (
        <div className="sticky top-3 z-20 mb-3 flex justify-center">
          <button
            type="button"
            onClick={applyPendingFreshPhotos}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2 font-sans text-[13px] font-medium text-white shadow-lg transition active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>Hay looks nuevos — Tocá para ver</span>
          </button>
        </div>
      ) : null}

      {errorBanner ? (
        <div className="mb-4 rounded-[16px] border border-danger/30 bg-paper px-4 py-3 font-sans text-[13px] text-danger">
          {errorBanner}
        </div>
      ) : null}

      {/* Estado de carga inicial */}
      {initialLoading ? (
        <div className="grid grid-cols-2 gap-[10px]">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="aspect-[4/5] animate-pulse rounded-[18px] border border-line bg-paper"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <SurfaceCard className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas text-vote">
            <Heart className="h-5 w-5" />
          </div>

          <h2 className="mt-4 font-serif text-[26px] leading-[1.15] font-medium text-ink">
            {activeTab === 'recent'
              ? 'Sé la primera persona en inaugurar la pasarela'
              : 'El podio todavía está esperando votos'}
          </h2>

          <p className="mx-auto mt-2 max-w-[310px] font-serif text-[20px] leading-[1.35] text-muted italic">
            Lindos, cómodos y bien ustedes: subí tu outfit o ayudá a postular el
            de alguien de tu mesa.
          </p>

          <EditorialDivider className="my-5" />

          <p className="font-sans text-[13px] text-muted">
            Podés votar con un ❤️ todos los looks que te gusten (1 voto máximo
            por foto desde tu celu).
          </p>

          {isLive && remainingSlots > 0 ? (
            <div className="mt-5">
              <PillButton
                fullWidth
                icon={<ImagePlus className="h-4 w-4" />}
                onClick={handleOpenPicker}
              >
                Elegir foto y postular mi Outfit
              </PillButton>
            </div>
          ) : null}
        </SurfaceCard>
      ) : (
        /* Grilla de 2 columnas en proporción vertical 4:5 */
        <div className="grid grid-cols-2 gap-[10px]">
          {photos.map((photo, index) => {
            const showPodiumBadge =
              activeTab === 'top' && index < 3 && photo.voteCount > 0;

            return (
              <article
                key={photo.id}
                className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-paper shadow-[0_8px_24px_rgba(64,54,44,0.04)]"
              >
                <div className="relative aspect-[4/5] w-full bg-canvas">
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoId(photo.id)}
                    aria-label={`Ver look de ${photo.authorAlias}`}
                    className="block h-full w-full cursor-pointer focus:outline-none"
                  >
                    <img
                      src={photo.thumbUrl}
                      alt={photo.caption ?? `Look de ${photo.authorAlias}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>

                  {showPodiumBadge ? (
                    <span className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-ink/88 px-2.5 py-1 font-sans text-[11px] font-semibold text-white backdrop-blur-xs">
                      <Trophy className="h-3 w-3" />#{index + 1}
                    </span>
                  ) : photo.isOwnPhoto ? (
                    <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-full border border-line bg-paper/92 px-2.5 py-0.5 font-sans text-[10px] font-medium tracking-[0.12em] text-ink uppercase">
                      Tu look
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col justify-between p-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-sans text-[13px] font-medium text-ink">
                      {photo.authorAlias}
                    </p>
                    {photo.caption ? (
                      <p className="mt-0.5 line-clamp-2 font-serif text-[16px] leading-tight text-muted italic">
                        “{photo.caption}”
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleHeartClick(photo)}
                    disabled={!isLive && !photo.votedByMe}
                    aria-pressed={photo.votedByMe}
                    aria-label={
                      photo.votedByMe
                        ? `Quitar voto al look de ${photo.authorAlias}`
                        : `Votar el look de ${photo.authorAlias}`
                    }
                    className={`mt-2.5 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border px-3 font-sans text-[14px] font-medium transition active:scale-95 disabled:cursor-default disabled:opacity-60 ${
                      photo.votedByMe
                        ? 'border-vote bg-vote text-white'
                        : 'border-line bg-canvas text-ink hover:border-accent'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${photo.votedByMe ? 'fill-current' : 'text-vote'}`}
                    />
                    <span>{photo.voteCount}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox compartido con soporte de voto y borrado propio / moderador */}
      <PhotoLightbox
        photo={selectedPhoto}
        canDelete={
          Boolean(selectedPhoto) &&
          (Boolean(selectedPhoto?.isOwnPhoto) || session.isModerator)
        }
        onClose={() => setSelectedPhotoId(null)}
        onDelete={handleDeletePhoto}
        onToggleVote={(photo) => handleHeartClick(photo)}
      />

      {/* BottomSheet de Postulación con Preview 4:5 en vivo */}
      <BottomSheet
        open={entrySheetOpen}
        onClose={() => {
          if (isBusyUploading) return;
          setEntrySheetOpen(false);
        }}
        title="Postular en Best Outfit"
        subtitle="Revisá tu foto y sumale un epígrafe corto si tenés ganas."
      >
        <div className="flex flex-col gap-3.5">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[4/5] w-44 overflow-hidden rounded-[18px] border border-line bg-canvas shadow-sm">
              <img
                src={previewUrl}
                alt="Vista previa de tu look"
                className="h-full w-full object-cover"
              />
              {!isBusyUploading ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 bottom-2 left-2 min-h-[40px] cursor-pointer rounded-full border border-line bg-paper/95 px-3 font-sans text-[12px] font-medium text-ink shadow"
                >
                  Cambiar foto
                </button>
              ) : null}
            </div>
          ) : (
            <PillButton
              variant="secondary"
              fullWidth
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Elegir foto del celular
            </PillButton>
          )}

          {!session.alias ? (
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[11px] tracking-[0.16em] text-muted uppercase">
                ¿Cómo te llamás?
              </span>
              <input
                type="text"
                value={inlineAlias}
                onChange={(event) => setInlineAlias(event.target.value)}
                disabled={isBusyUploading}
                placeholder="Ej: Sofi, Tío Carlos, Lau..."
                maxLength={WEDDING_CONFIG.limits.maxAliasLength}
                className="w-full rounded-[14px] border border-line bg-white px-4 py-[14px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="font-sans text-[11px] tracking-[0.16em] text-muted uppercase">
              Epígrafe corto (opcional)
            </span>
            <input
              type="text"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              disabled={isBusyUploading}
              placeholder="Ej: El look de la Abu Rosa"
              maxLength={WEDDING_CONFIG.limits.maxCaptionLength}
              className="w-full rounded-[14px] border border-line bg-white px-4 py-[14px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          </label>

          {isBusyUploading ? (
            <div className="rounded-[14px] border border-line bg-canvas p-3">
              <div className="flex items-center justify-between font-sans text-[13px] text-ink">
                <span>
                  {uploadStage === 'compressing'
                    ? 'Optimizando imagen en tu celu...'
                    : 'Subiendo tu look...'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {uploadError ? (
            <p className="rounded-[14px] border border-danger/30 bg-canvas px-3.5 py-2.5 font-sans text-[13px] text-danger">
              {uploadError}
            </p>
          ) : null}

          {uploadStage === 'failed' ? (
            <PillButton
              fullWidth
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void handlePublishEntry()}
            >
              Reintentar subida
            </PillButton>
          ) : (
            <PillButton
              fullWidth
              disabled={isBusyUploading || (!rawSelectedFile && !compressedFileReady)}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => void handlePublishEntry()}
            >
              {isBusyUploading ? 'Publicando...' : 'Publicar look'}
            </PillButton>
          )}
        </div>
      </BottomSheet>

      {/* BottomSheet liviano de Apodo solo si toca ❤️ sin haberse presentado antes */}
      <BottomSheet
        open={voteAliasSheetOpen}
        onClose={() => {
          if (savingVoteAlias) return;
          setVoteAliasSheetOpen(false);
          setPendingVotePhotoId(null);
        }}
        title="¿Cómo te llamás?"
        subtitle="Solo te lo pedimos esta primera vez para sumar tu ❤️."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveVoteAliasAndVote();
          }}
          className="flex flex-col gap-3.5"
        >
          <input
            type="text"
            value={voteDraftAlias}
            onChange={(event) => setVoteDraftAlias(event.target.value)}
            disabled={savingVoteAlias}
            placeholder="Ej: Magui, Fede, Prima Agus..."
            maxLength={WEDDING_CONFIG.limits.maxAliasLength}
            className="w-full rounded-[14px] border border-line bg-white px-4 py-[15px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />

          {voteAliasError ? (
            <p className="font-sans text-[13px] text-danger">{voteAliasError}</p>
          ) : null}

          <PillButton
            type="submit"
            fullWidth
            disabled={savingVoteAlias}
            icon={<Heart className="h-4 w-4" />}
          >
            {savingVoteAlias ? 'Guardando...' : 'Guardar y votar'}
          </PillButton>
        </form>
      </BottomSheet>
    </MobileShell>
  );
}
