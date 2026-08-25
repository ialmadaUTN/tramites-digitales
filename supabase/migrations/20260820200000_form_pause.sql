-- Disponibilidad del formulario: un formulario publicado puede pausarse y reactivarse.
-- Se guarda el instante de la pausa en lugar de un booleano para conservar la traza de cuándo se sacó de circulación.
-- paused_at is null  => disponible
-- paused_at not null => pausado
alter table public.forms
  add column if not exists paused_at timestamptz;

comment on column public.forms.paused_at is
  'Instante en que el formulario se pausó. Null significa disponible. La pausa es independiente de la publicación: publicar una versión nueva no reactiva.';
