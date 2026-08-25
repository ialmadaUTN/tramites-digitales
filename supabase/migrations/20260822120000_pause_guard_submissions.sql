-- Guard de disponibilidad al nivel de la base.
--
-- El BFF valida la pausa antes de armar la submission, pero entre ese chequeo y
-- el insert hay varias operaciones de I/O: verificación del token de contexto,
-- validación del payload, lookup de la versión y de los adjuntos. Si la pausa
-- ocurre dentro de esa ventana, la submission entraba igual y el cliente que
-- pausó ya había recibido una respuesta correcta.
--
-- El `for share` es lo que da atomicidad real, no solo una ventana más chica:
--   * Si la pausa todavía no commiteó, este select toma el lock compartido y el
--     `update forms set paused_at` espera a que el insert termine. La submission
--     entra y el formulario queda pausado después: orden consistente.
--   * Si la pausa ya commiteó, se ve `paused_at` y el insert se rechaza.
--
-- Vive acá y no en el servicio para que la garantía valga para cualquier cliente
-- y cualquier camino, incluido un insert directo contra PostgREST.
create or replace function public.reject_submission_when_form_paused()
returns trigger
language plpgsql
as $$
declare
  form_paused_at timestamptz;
begin
  select paused_at into form_paused_at
  from public.forms
  where id = new.form_id
  for share;

  if form_paused_at is not null then
    raise exception 'Este formulario no está disponible en este momento'
      using errcode = 'TD001';
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_reject_when_form_paused on public.submissions;

create trigger submissions_reject_when_form_paused
  before insert on public.submissions
  for each row
  execute function public.reject_submission_when_form_paused();

comment on function public.reject_submission_when_form_paused is
  'Rechaza submissions sobre formularios pausados. SQLSTATE TD001; el BFF lo traduce a 409 FORM_PAUSED.';
