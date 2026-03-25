package handler

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/repository"
)

type Guest struct {
	inv   *repository.Invitation
	guest *repository.Guest
	wish  *repository.Wish
}

func NewGuestHandler(inv *repository.Invitation, g *repository.Guest, wish *repository.Wish) *Guest {
	return &Guest{inv: inv, guest: g, wish: wish}
}

type createGuestBody struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}

// List GET /api/v1/invitations/:id/guests
func (h *Guest) List(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	invID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	inv, err := h.inv.GetByIDForUser(c.Context(), invID, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	list, err := h.guest.ListByInvitation(c.Context(), invID, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "list_failed"})
	}
	return c.JSON(fiber.Map{"guests": list})
}

// Create POST /api/v1/invitations/:id/guests
func (h *Guest) Create(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	invID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	var body createGuestBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	if body.Phone != nil {
		p := strings.TrimSpace(*body.Phone)
		if p == "" {
			body.Phone = nil
		} else {
			body.Phone = &p
		}
	}
	g, err := h.guest.Create(c.Context(), invID, uid, body.Name, body.Phone)
	if errors.Is(err, repository.ErrInvitationNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(g)
}

// ListRSVP GET /api/v1/invitations/:id/rsvp — respons RSVP + nama tamu (jika ada).
func (h *Guest) ListRSVP(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	invID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	inv, err := h.inv.GetByIDForUser(c.Context(), invID, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	list, err := h.guest.ListRSVPByInvitation(c.Context(), invID, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "list_failed"})
	}
	return c.JSON(fiber.Map{"rsvp": list})
}

// ListWishes GET /api/v1/invitations/:id/wishes — ucapan tamu (pemilik).
func (h *Guest) ListWishes(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	invID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	inv, err := h.inv.GetByIDForUser(c.Context(), invID, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	list, err := h.wish.ListForOwner(c.Context(), invID, uid, 250)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "list_failed"})
	}
	return c.JSON(fiber.Map{"wishes": list})
}
