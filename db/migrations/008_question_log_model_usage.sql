-- Model-written answers (optional, off unless a model key is set). Each
-- question records whether the answer shown was written by the model, which
-- model ran, how the attempt ended, and the tokens it used, so the running
-- cost can be reported. Existing rows keep model_written = false and empty
-- model columns.
ALTER TABLE question_log ADD COLUMN model_written boolean NOT NULL DEFAULT false;
ALTER TABLE question_log ADD COLUMN model text;
ALTER TABLE question_log ADD COLUMN model_outcome text;
ALTER TABLE question_log ADD COLUMN input_tokens integer;
ALTER TABLE question_log ADD COLUMN output_tokens integer;
