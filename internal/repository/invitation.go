package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/model"
	"undangan_pernikahan/internal/slug"
)

type Invitation struct {
	pool *pgxpool.Pool
}

func NewInvitation(pool *pgxpool.Pool) *Invitation {
	return &Invitation{pool: pool}
}

var ErrInvitationNotFound = errors.New("invitation not found")
var ErrSlugTaken = errors.New("slug already taken")

func (r *Invitation) Create(ctx context.Context, userID uuid.UUID, slugStr, title string) (*model.Invitation, error) {
	slugStr = slug.Normalize(slugStr)
	if slugStr == "" {
		return nil, errors.New("slug required")
	}
	var t *string
	if strings.TrimSpace(title) != "" {
		s := strings.TrimSpace(title)
		t = &s
	}
	var inv model.Invitation
	err := r.pool.QueryRow(ctx,
		`INSERT INTO invitations (user_id, slug, title) VALUES ($1, $2, $3)
		 RETURNING id, user_id, slug, title, is_published, settings, created_at, updated_at`,
		userID, slugStr, t,
	).Scan(&inv.ID, &inv.UserID, &inv.Slug, &inv.Title, &inv.IsPublished, &inv.Settings, &inv.CreatedAt, &inv.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrSlugTaken
		}
		return nil, err
	}
	return &inv, nil
}

func (r *Invitation) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.Invitation, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, slug, title, is_published, settings, created_at, updated_at
		 FROM invitations WHERE user_id = $1 ORDER BY updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.Invitation
	for rows.Next() {
		var inv model.Invitation
		if err := rows.Scan(&inv.ID, &inv.UserID, &inv.Slug, &inv.Title, &inv.IsPublished, &inv.Settings, &inv.CreatedAt, &inv.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, inv)
	}
	return list, rows.Err()
}

// Delete menghapus undangan milik user; slide, tamu, dan RSVP ikut terhapus (CASCADE).
func (r *Invitation) Delete(ctx context.Context, id, userID uuid.UUID) (deleted bool, err error) {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM invitations WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Invitation) GetByIDForUser(ctx context.Context, id, userID uuid.UUID) (*model.Invitation, error) {
	var inv model.Invitation
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, slug, title, is_published, settings, created_at, updated_at
		 FROM invitations WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&inv.ID, &inv.UserID, &inv.Slug, &inv.Title, &inv.IsPublished, &inv.Settings, &inv.CreatedAt, &inv.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

// GetPublishedBySlug untuk tamu (publik); hanya jika is_published = true.
// Mencoba slug apa adanya lalu versi dinormalisasi (kompatibel dengan URL/DB lama).
func (r *Invitation) GetPublishedBySlug(ctx context.Context, raw string) (*model.Invitation, error) {
	raw = strings.TrimSpace(raw)
	candidates := []string{raw}
	if n := slug.Normalize(raw); n != "" && n != raw {
		candidates = append(candidates, n)
	}
	for _, s := range candidates {
		var inv model.Invitation
		err := r.pool.QueryRow(ctx,
			`SELECT id, user_id, slug, title, is_published, settings, created_at, updated_at
			 FROM invitations WHERE slug = $1 AND is_published = true`,
			s,
		).Scan(&inv.ID, &inv.UserID, &inv.Slug, &inv.Title, &inv.IsPublished, &inv.Settings, &inv.CreatedAt, &inv.UpdatedAt)
		if err == nil {
			return &inv, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	return nil, nil
}

// Patch memperbarui title, is_published, dan/atau settings (JSON) milik pemilik.
func (r *Invitation) Patch(ctx context.Context, id, userID uuid.UUID, title *string, published *bool, settings *json.RawMessage) (*model.Invitation, error) {
	inv, err := r.GetByIDForUser(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, nil
	}

	newTitle := inv.Title
	if title != nil {
		s := strings.TrimSpace(*title)
		if s == "" {
			newTitle = nil
		} else {
			t := s
			newTitle = &t
		}
	}
	newPub := inv.IsPublished
	if published != nil {
		newPub = *published
	}
	newSettings := inv.Settings
	if settings != nil {
		newSettings = *settings
	}

	var out model.Invitation
	err = r.pool.QueryRow(ctx,
		`UPDATE invitations SET title = $1, is_published = $2, settings = $3::jsonb, updated_at = now()
		 WHERE id = $4 AND user_id = $5
		 RETURNING id, user_id, slug, title, is_published, settings, created_at, updated_at`,
		newTitle, newPub, newSettings, id, userID,
	).Scan(&out.ID, &out.UserID, &out.Slug, &out.Title, &out.IsPublished, &out.Settings, &out.CreatedAt, &out.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

type SlideInput struct {
	SlideType string
	Payload   []byte // JSON mentah
}

func (r *Invitation) ReplaceSlides(ctx context.Context, invitationID, userID uuid.UUID, slides []SlideInput) error {
	inv, err := r.GetByIDForUser(ctx, invitationID, userID)
	if err != nil {
		return err
	}
	if inv == nil {
		return ErrInvitationNotFound
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM slides WHERE invitation_id = $1`, invitationID); err != nil {
		return err
	}
	for i, s := range slides {
		if strings.TrimSpace(s.SlideType) == "" {
			return errors.New("slide_type required")
		}
		payload := s.Payload
		if len(payload) == 0 {
			payload = []byte(`{}`)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO slides (invitation_id, sort_order, slide_type, payload) VALUES ($1, $2, $3, $4::jsonb)`,
			invitationID, i, strings.TrimSpace(s.SlideType), payload,
		); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE invitations SET updated_at = now() WHERE id = $1`, invitationID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Invitation) ListSlides(ctx context.Context, invitationID uuid.UUID) ([]model.Slide, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, invitation_id, sort_order, slide_type, payload, created_at
		 FROM slides WHERE invitation_id = $1 ORDER BY sort_order ASC`,
		invitationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.Slide
	for rows.Next() {
		var s model.Slide
		var payload []byte
		if err := rows.Scan(&s.ID, &s.InvitationID, &s.SortOrder, &s.SlideType, &payload, &s.CreatedAt); err != nil {
			return nil, err
		}
		s.Payload = payload
		list = append(list, s)
	}
	return list, rows.Err()
}
