package handler

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/repository"
)

type Public struct {
	inv   *repository.Invitation
	guest *repository.Guest
	wish  *repository.Wish
}

func NewPublic(inv *repository.Invitation, guest *repository.Guest, wish *repository.Wish) *Public {
	return &Public{inv: inv, guest: guest, wish: wish}
}

// BySlug GET /api/v1/public/invitations/:slug — tanpa auth; hanya undangan is_published.
// Query opsional ?token= untuk personalisasi tamu (nama) tanpa mengulang token di body.
func (p *Public) BySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_slug"})
	}
	inv, err := p.inv.GetPublishedBySlug(c.Context(), slug)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	slides, err := p.inv.ListSlides(c.Context(), inv.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "slides_failed"})
	}

	var settings any
	if len(inv.Settings) > 0 {
		var m map[string]any
		if err := json.Unmarshal(inv.Settings, &m); err == nil && m != nil {
			delete(m, "flow_layout")
			settings = m
		} else {
			_ = json.Unmarshal(inv.Settings, &settings)
		}
	}
	if settings == nil {
		settings = map[string]any{}
	}

	out := fiber.Map{
		"id":           inv.ID,
		"slug":         inv.Slug,
		"title":        inv.Title,
		"is_published": inv.IsPublished,
		"settings":     settings,
		"created_at":   inv.CreatedAt,
		"updated_at":   inv.UpdatedAt,
		"slides":       slides,
	}

	token := c.Query("token")
	if token != "" {
		g, err := p.guest.GetByTokenPublished(c.Context(), slug, token)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "guest_lookup_failed"})
		}
		if g != nil {
			out["guest"] = fiber.Map{
				"name":  g.Name,
				"phone": g.Phone,
			}
		}
	}

	return c.JSON(out)
}

type rsvpBody struct {
	Token string          `json:"token"`
	Data  json.RawMessage `json:"data"`
}

// RSVP POST /api/v1/public/invitations/:slug/rsvp — token wajib (tamu terdaftar).
func (p *Public) RSVP(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_slug"})
	}
	var body rsvpBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	if body.Token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token_required"})
	}
	data := []byte(body.Data)
	if len(data) == 0 {
		data = []byte(`{}`)
	}

	inv, err := p.inv.GetPublishedBySlug(c.Context(), slug)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}

	g, err := p.guest.GetByInvitationAndToken(c.Context(), inv.ID, body.Token)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if g == nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid_token"})
	}

	resp, err := p.guest.InsertRSVP(c.Context(), inv.ID, &g.ID, data)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "rsvp_failed"})
	}
	return c.Status(201).JSON(resp)
}

// Wishes GET /api/v1/public/invitations/:slug/wishes — ucapan tamu (undangan terbit).
func (p *Public) Wishes(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_slug"})
	}
	inv, err := p.inv.GetPublishedBySlug(c.Context(), slug)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	list, err := p.wish.ListPublishedByInvitation(c.Context(), inv.ID, 150)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "wishes_failed"})
	}
	out := make([]fiber.Map, 0, len(list))
	for _, w := range list {
		m := fiber.Map{
			"id":          w.ID,
			"author_name": w.AuthorName,
			"message":     w.Message,
			"created_at":  w.CreatedAt,
		}
		if w.GuestID != nil {
			m["from_guest"] = true
		}
		out = append(out, m)
	}
	return c.JSON(fiber.Map{"wishes": out})
}

type wishBody struct {
	Token       string `json:"token"`
	AuthorName  string `json:"author_name"`
	Message     string `json:"message"`
}

// PostWish POST /api/v1/public/invitations/:slug/wishes — kirim ucapan; token opsional (tamu terdaftar).
func (p *Public) PostWish(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_slug"})
	}
	var body wishBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	inv, err := p.inv.GetPublishedBySlug(c.Context(), slug)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	author := strings.TrimSpace(body.AuthorName)
	msg := strings.TrimSpace(body.Message)
	var guestID *uuid.UUID
	tok := strings.TrimSpace(body.Token)
	if tok != "" {
		g, err := p.guest.GetByInvitationAndToken(c.Context(), inv.ID, tok)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed"})
		}
		if g == nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid_token"})
		}
		guestID = &g.ID
		if author == "" {
			author = g.Name
		}
	}
	if author == "" {
		return c.Status(400).JSON(fiber.Map{"error": "author_required"})
	}
	w, err := p.wish.Insert(c.Context(), inv.ID, guestID, author, msg)
	if errors.Is(err, repository.ErrWishInvalid) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_wish"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "wish_failed"})
	}
	return c.Status(201).JSON(w)
}
