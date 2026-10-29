-- Atendimento 100% on-line: sem endereço, sem texto de horário e sem consultas presenciais.
UPDATE "services" SET "modality" = 'online' WHERE "modality" <> 'online';--> statement-breakpoint
UPDATE "appointments" SET "modality" = 'online' WHERE "modality" <> 'online';--> statement-breakpoint
UPDATE "settings" SET
  "address" = NULL,
  "hours_text" = NULL,
  "modality_text" = NULL,
  "signature_text" = replace("signature_text", 'atendimento presencial e on-line', 'atendimento on-line'),
  "chat_auto_reply" = replace("chat_auto_reply", 'no próximo horário de atendimento (segunda a sexta, 8h às 18h)', 'assim que possível'),
  "differentials" = replace("differentials"::text, 'Avaliação física presencial ou on-line', 'Avaliação completa por videochamada')::jsonb,
  "plans_included" = replace("plans_included"::text, 'Presencial ou online.', 'Por videochamada, com medidas orientadas.')::jsonb;
