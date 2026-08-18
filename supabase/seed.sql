insert into public.forms (public_id, name, draft_definition)
values (
  '11111111-1111-4111-8111-111111111111',
  'Denuncia de siniestro — demo',
  '{
    "title": "Denuncia de siniestro",
    "description": "Formulario de ejemplo para probar el motor dinámico.",
    "submitLabel": "Enviar denuncia",
    "containers": [
      {
        "id": "customer",
        "title": "Datos del asegurado",
        "columns": 2,
        "fields": [
          {
            "id": "full-name",
            "fieldName": "fullName",
            "type": "text",
            "label": "Nombre completo",
            "placeholder": "Ej. Ana Pérez",
            "width": "full",
            "rules": {"required": true, "minLength": 3, "errorMessages": {"required": "El nombre es obligatorio"}}
          },
          {
            "id": "email",
            "fieldName": "email",
            "type": "text",
            "label": "Correo electrónico",
            "placeholder": "ana@example.com",
            "rules": {"required": true, "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", "errorMessages": {"required": "El correo es obligatorio", "pattern": "Ingresá un correo válido"}}
          },
          {
            "id": "policy-number",
            "fieldName": "policyNumber",
            "type": "number",
            "label": "Número de póliza",
            "rules": {"required": true, "min": 1, "errorMessages": {"required": "La póliza es obligatoria", "min": "Debe ser mayor a cero"}}
          },
          {
            "id": "incident-date",
            "fieldName": "incidentDate",
            "type": "date",
            "label": "Fecha del siniestro",
            "rules": {"required": true}
          }
        ]
      },
      {
        "id": "incident",
        "title": "Detalle del hecho",
        "columns": 1,
        "fields": [
          {
            "id": "incident-type",
            "fieldName": "incidentType",
            "type": "select",
            "label": "Tipo de siniestro",
            "options": [{"label": "Robo", "value": "theft"}, {"label": "Accidente", "value": "accident"}, {"label": "Otro", "value": "other"}],
            "rules": {"required": true}
          },
          {
            "id": "has-witnesses",
            "fieldName": "hasWitnesses",
            "type": "radio",
            "label": "¿Hubo testigos?",
            "options": [{"label": "Sí", "value": "yes"}, {"label": "No", "value": "no"}],
            "rules": {"required": true}
          },
          {
            "id": "witness-name",
            "fieldName": "witnessName",
            "type": "text",
            "label": "Nombre del testigo",
            "conditions": {"visible": {"logic": "all", "rules": [{"fieldId": "has-witnesses", "operator": "equals", "value": "yes"}]}, "required": {"logic": "all", "rules": [{"fieldId": "has-witnesses", "operator": "equals", "value": "yes"}]}},
            "rules": {"minLength": 3}
          },
          {
            "id": "description",
            "fieldName": "description",
            "type": "textarea",
            "label": "Descripción",
            "placeholder": "Contanos qué ocurrió",
            "rules": {"required": true, "minLength": 20, "maxLength": 500, "errorMessages": {"required": "La descripción es obligatoria", "minLength": "Escribí al menos 20 caracteres"}}
          },
          {
            "id": "contact-time",
            "fieldName": "contactTime",
            "type": "time",
            "label": "Horario de contacto preferido"
          },
          {
            "id": "accept",
            "fieldName": "acceptTerms",
            "type": "checkbox",
            "label": "Acepto que los datos sean utilizados para gestionar el trámite",
            "rules": {"required": true, "errorMessages": {"required": "Tenés que aceptar para continuar"}}
          }
        ]
      }
    ]
  }'::jsonb
)
on conflict (public_id) do nothing;

insert into public.form_versions (form_id, version_number, definition)
select id, 1, draft_definition from public.forms
where public_id = '11111111-1111-4111-8111-111111111111'
  and not exists (
    select 1 from public.form_versions version
    where version.form_id = public.forms.id and version.version_number = 1
  );

update public.forms
set published_version_id = (
  select id from public.form_versions
  where form_id = public.forms.id and version_number = 1
), updated_at = now()
where public_id = '11111111-1111-4111-8111-111111111111';
