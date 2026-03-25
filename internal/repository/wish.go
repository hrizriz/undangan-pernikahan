package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/model"
)

type Wish struct {
	pool *pgxpool.Pool
}

func NewWish(pool *pgxpool.Pool) *Wish {
	return &Wish{pool: pool}
}

var ErrWishInvalid = errors.New("invalid_wish")

const (
	maxWishAuthor  = 120
	maxWishMessage = 2000
)

// Insert ucapan untuk undangan yang sudah dipublikasikan.
func (r *Wish) Insert(ctx context.Context, invitationID uuid.UUID, guestID *uuid.UUID, authorName, message string) (*model.GuestWish, error) {
	authorName = strings.TrimSpace(authorName)
	message = strings.TrimSpace(message)
	if authorName == "" || len(authorName) > maxWishAuthor {
		return nil, ErrWishInvalid
	}
	if message == "" || len(message) > maxWishMessage {
		return nil, ErrWishInvalid
	}
	var out model.GuestWish
	err := r.pool.QueryRow(ctx,
		`INSERT INTO guest_wishes (invitation_id, guest_id, author_name, message)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, invitation_id, guest_id, author_name, message, created_at`,
		invitationID, guestID, authorName, message,
	).Scan(&out.ID, &out.InvitationID, &out.GuestID, &out.AuthorName, &out.Message, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// ListPublishedByInvitation untuk tamu (tanpa cek user — panggil hanya setelah undangan verified published).
func (r *Wish) ListPublishedByInvitation(ctx context.Context, invitationID uuid.UUID, limit int) ([]model.GuestWish, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx,
		`SELECT w.id, w.invitation_id, w.guest_id, w.author_name, w.message, w.created_at
		 FROM guest_wishes w
		 INNER JOIN invitations i ON i.id = w.invitation_id AND i.is_published = true
		 WHERE w.invitation_id = $1
		 ORDER BY w.created_at DESC
		 LIMIT $2`,
		invitationID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWishRows(rows)
}

// ListForOwner daftar ucapan milik undangan (pemilik).
func (r *Wish) ListForOwner(ctx context.Context, invitationID, ownerUserID uuid.UUID, limit int) ([]model.GuestWish, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := r.pool.Query(ctx,
		`SELECT w.id, w.invitation_id, w.guest_id, w.author_name, w.message, w.created_at
		 FROM guest_wishes w
		 INNER JOIN invitations i ON i.id = w.invitation_id AND i.user_id = $2
		 WHERE w.invitation_id = $1
		 ORDER BY w.created_at DESC
		 LIMIT $3`,
		invitationID, ownerUserID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanWishRows(rows)
}

func scanWishRows(rows pgx.Rows) ([]model.GuestWish, error) {
	var list []model.GuestWish
	for rows.Next() {
		var w model.GuestWish
		if err := rows.Scan(&w.ID, &w.InvitationID, &w.GuestID, &w.AuthorName, &w.Message, &w.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	if list == nil {
		list = make([]model.GuestWish, 0)
	}
	return list, rows.Err()
}
