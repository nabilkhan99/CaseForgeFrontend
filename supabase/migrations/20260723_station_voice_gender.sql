-- Voice gender for Clinical Master patient voice selection.
--
-- The gpt-realtime voice is chosen server-side at session-mint time. Before
-- this, every patient spoke with the default female voice ("marin"), so male
-- patients sounded female. This column records the gender of the person the
-- doctor actually speaks to — the standardised patient, or, in a paediatric /
-- third-party case, the parent, carer, or paramedic voicing the case — so the
-- voice can match (see lib/clinical-master/realtimeSession.ts voiceForStation()).
--
-- Nullable and unconstrained-by-default: any untagged station keeps the prior
-- behaviour (default female voice), so this is backward-compatible.

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS voice_gender text;

COMMENT ON COLUMN stations.voice_gender IS
  'Gender of the voice the doctor hears (patient, or the parent/carer/paramedic speaking for them): ''male'' | ''female'' | null. Drives gpt-realtime voice selection.';
