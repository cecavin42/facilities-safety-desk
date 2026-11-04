-- Record second-factor completion on the server, independent of clock precision.
ALTER TABLE "session" ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false;
