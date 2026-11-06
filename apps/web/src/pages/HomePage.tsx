import { GuestAliasSchema, type PhotoItemDto, WEDDING_CONFIG } from '@wedding/shared';
import { ArrowRight, Camera, Heart, Music, Shield, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BentoModuleCard,
  BottomSheet,
  EditorialDivider,
  MobileShell,
  PillButton,
  SurfaceCard,
  WeddingHeader,
} from '../components/ui/index.js';
import { useSession } from '../context/SessionContext.js';
import { fetchPhotos } from '../lib/api.js';

export function HomePage() {
  const { session, saveAlias } = useSession();
  const [recentPhotos, setRecentPhotos] = useState<PhotoItemDto[]>([]);
  const [editAliasOpen, setEditAliasOpen] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPhotos('general', 'recent')
      .then((res) => {
        if (active) {
          setRecentPhotos(res.photos.slice(0, 4));
        }
      })
      .catch(() => {
        // Silencioso en portada
      });
    return () => {
      active = false;
    };
  }, []);

  const hasSecondaryModules =
    WEDDING_CONFIG.modules.best_bloopers !== 'hidden' ||
    WEDDING_CONFIG.modules.bingo !== 'hidden';

  const handleOpenEditAlias = () => {
    setAliasInput(session.alias ?? '');
    setAliasError(null);
    setEditAliasOpen(true);
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = GuestAliasSchema.safeParse(aliasInput);
    if (!parsed.success) {
      setAliasError(parsed.error.issues[0]?.message ?? 'Ingresá tu nombre.');
      return;
    }
    try {
      await saveAlias(parsed.data);
      setEditAliasOpen(false);
    } catch (err) {
      setAliasError(err instanceof Error ? err.message : 'No pudimos guardar el nombre.');
    }
  };

  return (
    <MobileShell>
      <WeddingHeader
        variant="home"
        guestAlias={session.alias}
        onEditAlias={handleOpenEditAlias}
      />

      {session.eventMode === 'read_only' ? (
        <div className="mt-4 rounded-[16px] border border-line bg-paper px-4 py-3 text-center font-sans text-[13px] text-muted">
          ¡Gracias por acompañarnos! Podés mirar y descargar todos los recuerdos del
          casamiento.
        </div>
      ) : null}

      <EditorialDivider className="my-5" />

      {/* Fila Principal [] []: Álbum General y Best Outfit */}
      <section aria-label="Secciones principales">
        <div className="grid grid-cols-2 gap-3">
          <BentoModuleCard
            availability={WEDDING_CONFIG.modules.general}
            to="/galeria"
            eyebrow="Fotos"
            title="Álbum General"
            description="Subí y mirá las fotos que van sacando hoy."
            icon={<Camera className="h-4 w-4" />}
          />

          <BentoModuleCard
            availability={WEDDING_CONFIG.modules.best_outfit}
            to="/best-outfit"
            eyebrow={WEDDING_CONFIG.dressCode}
            title="Best Outfit"
            description="Postulá un look y votá tus favoritos con ❤️."
            icon={<Heart className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Fila Secundaria [] []: Todo lo otro (Bloopers / Bingo) */}
      {hasSecondaryModules ? (
        <section aria-label="Próximas dinámicas" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <BentoModuleCard
              availability={WEDDING_CONFIG.modules.best_bloopers}
              to="/best-bloopers"
              eyebrow="Competencia"
              title="Best Bloopers"
              description="Momentos espontáneos y divertidos."
              icon={<Sparkles className="h-4 w-4" />}
            />

            <BentoModuleCard
              availability={WEDDING_CONFIG.modules.bingo}
              to="/bingo"
              eyebrow="Juego"
              title="Bingo Musical"
              description="Cartones de temas durante el brunch."
              icon={<Music className="h-4 w-4" />}
            />
          </div>
        </section>
      ) : null}

      {/* Vista previa bien al fondo (sin cartel 'En directo') */}
      <section aria-label="Últimos recuerdos compartidos" className="mt-6">
        <SurfaceCard className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-[11px] tracking-[0.18em] text-muted uppercase">
              Últimas fotos
            </span>
            <Link
              to="/galeria"
              className="inline-flex items-center gap-1 font-sans text-[12px] font-medium text-ink no-underline hover:underline"
            >
              <span>Abrir álbum</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentPhotos.length > 0 ? (
            <Link
              to="/galeria"
              className="mt-3 grid grid-cols-4 gap-2 no-underline"
            >
              {recentPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square overflow-hidden rounded-[12px] border border-line bg-canvas"
                >
                  <img
                    src={photo.thumbUrl}
                    alt={`Foto de ${photo.authorAlias}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </Link>
          ) : (
            <p className="mt-2.5 font-sans text-[13px] text-muted">
              A medida que suban fotos en <strong>Álbum General</strong> se van a ir
              asomando acá abajo.
            </p>
          )}
        </SurfaceCard>
      </section>

      <footer className="mt-auto pt-8 text-center">
        <EditorialDivider className="mb-4" />
        <p className="font-sans text-[12px] text-muted">{WEDDING_CONFIG.venue}</p>
        <div className="mt-1">
          <Link
            to="/moderador"
            className="inline-flex min-h-[48px] items-center gap-1.5 px-3 font-sans text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>
              {session.isModerator ? 'Modo moderador activo' : 'Acceso organización'}
            </span>
          </Link>
        </div>
      </footer>

      <BottomSheet
        open={editAliasOpen}
        onClose={() => setEditAliasOpen(false)}
        title="Tu nombre"
        subtitle="Así van a aparecer firmadas las fotos que subas."
      >
        <form onSubmit={(e) => void handleSaveAlias(e)} className="flex flex-col gap-3">
          <input
            type="text"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            placeholder="Ej: Sofi, Tío Carlos..."
            maxLength={WEDDING_CONFIG.limits.maxAliasLength}
            className="w-full rounded-[14px] border border-line bg-white px-4 py-[15px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
          {aliasError ? (
            <p className="font-sans text-[13px] text-danger">{aliasError}</p>
          ) : null}
          <PillButton type="submit" fullWidth>
            Guardar nombre
          </PillButton>
        </form>
      </BottomSheet>
    </MobileShell>
  );
}
