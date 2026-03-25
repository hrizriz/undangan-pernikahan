-- +goose Up
-- +goose StatementBegin
ALTER TABLE invitations
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::jsonb;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE invitations
    DROP COLUMN IF EXISTS settings;
-- +goose StatementEnd
