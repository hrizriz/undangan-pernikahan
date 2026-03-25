package repository

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/model"
	"undangan_pernikahan/internal/slug"
)

type Guest struct {
	pool *pgxpool.Pool
}

func NewGuest(pool *pgxpool.Pool) *Guest {
	return &Guest{pool: pool}
}

var ErrGuestNotFound = errors.New("guest not found")

func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Create menambah tamu; token unik untuk link personal.
func (r *Guest) Create(ctx context.Context, invitationID, ownerUserID uuid.UUID, name string, phone *string) (*model.Guest, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("name required")
	}
	var invUser uuid.UUID
	err := r.pool.QueryRow(ctx,
		`SELECT user_id FROM invitations WHERE id = $1`,
		invitationID,
	).Scan(&invUser)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvitationNotFound
	}
	if err != nil {
		return nil, err
	}
	if invUser != ownerUserID {
		return nil, ErrInvitationNotFound
	}

	var g model.Guest
	for attempt := 0; attempt < 5; attempt++ {
		tok, err := randomToken()
		if err != nil {
			return nil, err
		}
		err = r.pool.QueryRow(ctx,
			`INSERT INTO guests (invitation_id, token, name, phone) VALUES ($1, $2, $3, $4)
			 RETURNING id, invitation_id, token, name, phone, created_at`,
			invitationID, tok, name, phone,
		).Scan(&g.ID, &g.InvitationID, &g.Token, &g.Name, &g.Phone, &g.CreatedAt)
		if err == nil {
			return &g, nil
		}
		if isUniqueViolation(err) {
			continue
		}
		return nil, err
	}
	return nil, errors.New("token collision")
}

// ListByInvitation tamu milik undangan (pemilik dicek lepas di handler).
func (r *Guest) ListByInvitation(ctx context.Context, invitationID, ownerUserID uuid.UUID) ([]model.Guest, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT g.id, g.invitation_id, g.token, g.name, g.phone, g.created_at
		 FROM guests g
		 INNER JOIN invitations i ON i.id = g.invitation_id
		 WHERE g.invitation_id = $1 AND i.user_id = $2
		 ORDER BY g.created_at ASC`,
		invitationID, ownerUserID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.Guest
	for rows.Next() {
		var g model.Guest
		if err := rows.Scan(&g.ID, &g.InvitationID, &g.Token, &g.Name, &g.Phone, &g.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	if list == nil {
		list = make([]model.Guest, 0)
	}
	return list, rows.Err()
}

// GetByInvitationAndToken untuk RSVP: tamu harus milik undangan ini.
func (r *Guest) GetByInvitationAndToken(ctx context.Context, invitationID uuid.UUID, token string) (*model.Guest, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, nil
	}
	var g model.Guest
	err := r.pool.QueryRow(ctx,
		`SELECT id, invitation_id, token, name, phone, created_at FROM guests
		 WHERE invitation_id = $1 AND token = $2`,
		invitationID, token,
	).Scan(&g.ID, &g.InvitationID, &g.Token, &g.Name, &g.Phone, &g.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// GetByTokenPublished mengambil tamu jika slug undangan published + token cocok.
func (r *Guest) GetByTokenPublished(ctx context.Context, slugStr, token string) (*model.Guest, error) {
	slugStr = strings.TrimSpace(slugStr)
	token = strings.TrimSpace(token)
	if slugStr == "" || token == "" {
		return nil, nil
	}
	candidates := []string{slugStr}
	if n := slug.Normalize(slugStr); n != "" && n != slugStr {
		candidates = append(candidates, n)
	}
	for _, s := range candidates {
		var g model.Guest
		err := r.pool.QueryRow(ctx,
			`SELECT g.id, g.invitation_id, g.token, g.name, g.phone, g.created_at
			 FROM guests g
			 INNER JOIN invitations i ON i.id = g.invitation_id
			 WHERE i.slug = $1 AND g.token = $2 AND i.is_published = true`,
			s, token,
		).Scan(&g.ID, &g.InvitationID, &g.Token, &g.Name, &g.Phone, &g.CreatedAt)
		if err == nil {
			return &g, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	return nil, nil
}

// ListRSVPByInvitation daftar RSVP untuk undangan (hanya pemilik).
func (r *Guest) ListRSVPByInvitation(ctx context.Context, invitationID, ownerUserID uuid.UUID) ([]model.RSVPEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.invitation_id, r.guest_id, r.data, r.created_at, g.name AS guest_name
		 FROM rsvp_responses r
		 INNER JOIN invitations i ON i.id = r.invitation_id
		 LEFT JOIN guests g ON g.id = r.guest_id
		 WHERE r.invitation_id = $1 AND i.user_id = $2
		 ORDER BY r.created_at DESC`,
		invitationID, ownerUserID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []model.RSVPEntry
	for rows.Next() {
		var e model.RSVPEntry
		if err := rows.Scan(&e.ID, &e.InvitationID, &e.GuestID, &e.Data, &e.CreatedAt, &e.GuestName); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	if list == nil {
		list = make([]model.RSVPEntry, 0)
	}
	return list, rows.Err()
}

// InsertRSVP menyimpan jawaban RSVP (tamu teridentifikasi lewat token di handler).
func (r *Guest) InsertRSVP(ctx context.Context, invitationID uuid.UUID, guestID *uuid.UUID, data []byte) (*model.RSVPResponse, error) {
	if len(data) == 0 {
		data = []byte(`{}`)
	}
	var out model.RSVPResponse
	err := r.pool.QueryRow(ctx,
		`INSERT INTO rsvp_responses (invitation_id, guest_id, data) VALUES ($1, $2, $3::jsonb)
		 RETURNING id, invitation_id, guest_id, data, created_at`,
		invitationID, guestID, data,
	).Scan(&out.ID, &out.InvitationID, &out.GuestID, &out.Data, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
