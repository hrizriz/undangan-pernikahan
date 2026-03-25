package handler

import (
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/model"
	"undangan_pernikahan/internal/repository"
)

type Invitation struct {
	repo *repository.Invitation
}

func NewInvitation(repo *repository.Invitation) *Invitation {
	return &Invitation{repo: repo}
}

type createInvitationBody struct {
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

// Create POST /api/v1/invitations
func (h *Invitation) Create(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	var body createInvitationBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	inv, err := h.repo.Create(c.Context(), uid, body.Slug, body.Title)
	if errors.Is(err, repository.ErrSlugTaken) {
		return c.Status(409).JSON(fiber.Map{"error": "slug_taken"})
	}
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(inv)
}

// List GET /api/v1/invitations
func (h *Invitation) List(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	list, err := h.repo.ListByUser(c.Context(), uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "list_failed"})
	}
	if list == nil {
		list = make([]model.Invitation, 0)
	}
	return c.JSON(fiber.Map{"invitations": list})
}

// Get GET /api/v1/invitations/:id — pemilik + slides
func (h *Invitation) Get(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	inv, err := h.repo.GetByIDForUser(c.Context(), id, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	slides, err := h.repo.ListSlides(c.Context(), inv.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "slides_failed"})
	}
	inv.Slides = slides
	return c.JSON(inv)
}

// Preview GET /api/v1/invitations/:id/preview — bentuk sama seperti respons publik (tanpa flow_layout);
// hanya pemilik; undangan draf boleh (untuk pratinjau di dashboard).
func (h *Invitation) Preview(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	inv, err := h.repo.GetByIDForUser(c.Context(), id, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	slides, err := h.repo.ListSlides(c.Context(), inv.ID)
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

	return c.JSON(fiber.Map{
		"id":             inv.ID,
		"slug":           inv.Slug,
		"title":          inv.Title,
		"is_published":   inv.IsPublished,
		"settings":       settings,
		"created_at":     inv.CreatedAt,
		"updated_at":     inv.UpdatedAt,
		"slides":         slides,
		"preview_mode":   true,
	})
}

type patchInvitationBody struct {
	Title       *string          `json:"title"`
	IsPublished *bool            `json:"is_published"`
	Settings    *json.RawMessage `json:"settings,omitempty"`
}

// Patch PATCH /api/v1/invitations/:id
func (h *Invitation) Patch(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	var body patchInvitationBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	if body.Title == nil && body.IsPublished == nil && body.Settings == nil {
		return c.Status(400).JSON(fiber.Map{"error": "no_fields"})
	}
	inv, err := h.repo.Patch(c.Context(), id, uid, body.Title, body.IsPublished, body.Settings)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "patch_failed"})
	}
	if inv == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	return c.JSON(inv)
}

type putSlidesBody struct {
	Slides []struct {
		SlideType string          `json:"slide_type"`
		Payload   json.RawMessage `json:"payload"`
	} `json:"slides"`
}

// ReplaceSlides PUT /api/v1/invitations/:id/slides — ganti seluruh urutan slide
func (h *Invitation) ReplaceSlides(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	var body putSlidesBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_json"})
	}
	inputs := make([]repository.SlideInput, 0, len(body.Slides))
	for _, s := range body.Slides {
		payload := []byte(s.Payload)
		if len(payload) == 0 {
			payload = []byte(`{}`)
		}
		inputs = append(inputs, repository.SlideInput{
			SlideType: s.SlideType,
			Payload:   payload,
		})
	}
	err = h.repo.ReplaceSlides(c.Context(), id, uid, inputs)
	if errors.Is(err, repository.ErrInvitationNotFound) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	slides, err := h.repo.ListSlides(c.Context(), id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "slides_failed"})
	}
	return c.JSON(fiber.Map{"slides": slides})
}

// Delete DELETE /api/v1/invitations/:id — hapus undangan beserta slide, tamu, RSVP.
func (h *Invitation) Delete(c *fiber.Ctx) error {
	uid, err := MustUserID(c)
	if err != nil {
		return err
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid_id"})
	}
	ok, err := h.repo.Delete(c.Context(), id, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "delete_failed"})
	}
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	return c.SendStatus(204)
}
