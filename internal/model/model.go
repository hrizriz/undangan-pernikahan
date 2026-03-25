package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID  `json:"id"`
	Email           string     `json:"email"`
	Role            string     `json:"role"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type Invitation struct {
	ID          uuid.UUID       `json:"id"`
	UserID      uuid.UUID       `json:"user_id"`
	Slug        string          `json:"slug"`
	Title       *string         `json:"title,omitempty"`
	IsPublished bool            `json:"is_published"`
	Settings    json.RawMessage `json:"settings,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	Slides      []Slide         `json:"slides,omitempty"`
}

type Slide struct {
	ID           uuid.UUID       `json:"id"`
	InvitationID uuid.UUID       `json:"invitation_id,omitempty"`
	SortOrder    int             `json:"sort_order"`
	SlideType    string          `json:"slide_type"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    time.Time       `json:"created_at,omitempty"`
}

// Guest tamu undangan (link personal pakai token).
type Guest struct {
	ID           uuid.UUID `json:"id"`
	InvitationID uuid.UUID `json:"invitation_id"`
	Token        string    `json:"token"`
	Name         string    `json:"name"`
	Phone        *string   `json:"phone,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// RSVPResponse satu jawaban RSVP (data fleksibel JSON).
type RSVPResponse struct {
	ID           uuid.UUID       `json:"id"`
	InvitationID uuid.UUID       `json:"invitation_id"`
	GuestID      *uuid.UUID      `json:"guest_id,omitempty"`
	Data         json.RawMessage `json:"data"`
	CreatedAt    time.Time       `json:"created_at"`
}

// RSVPEntry untuk daftar RSVP di dashboard (nama tamu dari join).
type RSVPEntry struct {
	ID           uuid.UUID       `json:"id"`
	InvitationID uuid.UUID       `json:"invitation_id"`
	GuestID      *uuid.UUID      `json:"guest_id,omitempty"`
	GuestName    *string         `json:"guest_name,omitempty"`
	Data         json.RawMessage `json:"data"`
	CreatedAt    time.Time       `json:"created_at"`
}

// GuestWish ucapan / buku tamu (boleh dari tamu ber-token atau nama bebas).
type GuestWish struct {
	ID             uuid.UUID  `json:"id"`
	InvitationID   uuid.UUID  `json:"invitation_id"`
	GuestID        *uuid.UUID `json:"guest_id,omitempty"`
	AuthorName     string     `json:"author_name"`
	Message        string     `json:"message"`
	CreatedAt      time.Time  `json:"created_at"`
}
