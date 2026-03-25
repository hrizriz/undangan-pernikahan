-- +goose Up
-- +goose StatementBegin
ALTER TABLE invitations
    ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE invitations
    DROP COLUMN IF EXISTS is_published;
-- +goose StatementEnd
