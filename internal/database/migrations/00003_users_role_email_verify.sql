-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN email_verify_token TEXT NULL;
ALTER TABLE users ADD COLUMN email_verify_expires_at TIMESTAMPTZ NULL;
CREATE UNIQUE INDEX idx_users_email_verify_token ON users (email_verify_token)
    WHERE email_verify_token IS NOT NULL;
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_users_email_verify_token;
ALTER TABLE users DROP COLUMN IF EXISTS email_verify_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS email_verify_token;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS role;
-- +goose StatementEnd
