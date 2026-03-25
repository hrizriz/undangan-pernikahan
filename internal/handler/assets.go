package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"undangan_pernikahan/internal/config"
	"undangan_pernikahan/internal/middleware"
	"undangan_pernikahan/internal/storage"
)

type Assets struct {
	s3  *storage.S3
	cfg config.Config
}

func NewAssets(s3c *storage.S3, cfg config.Config) *Assets {
	return &Assets{s3: s3c, cfg: cfg}
}

// UploadHeaderImage POST /api/v1/assets/header-image (auth)
// multipart/form-data: file=<image>
func (h *Assets) UploadHeaderImage(c *fiber.Ctx) error {
	uid, ok := middleware.UserID(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if h.s3 == nil {
		return c.Status(503).JSON(fiber.Map{"error": "storage_not_configured"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file_required"})
	}
	if fh.Size <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "empty_file"})
	}
	// 5MB cukup untuk logo/header.
	if fh.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "file_too_large"})
	}

	f, err := fh.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file_open_failed"})
	}
	defer f.Close()

	buf, err := io.ReadAll(io.LimitReader(f, 5*1024*1024+1))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "read_failed"})
	}
	if len(buf) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "empty_file"})
	}

	contentType := sniffContentType(fh.Filename, buf)
	if !strings.HasPrefix(contentType, "image/") {
		return c.Status(400).JSON(fiber.Map{"error": "unsupported_file_type"})
	}

	key := buildHeaderImageKey(uid, fh.Filename)
	url, err := h.s3.PutPublicObject(c.Context(), key, buf, contentType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "upload_failed"})
	}

	return c.JSON(fiber.Map{
		"url": url,
		"key": key,
	})
}

// UploadBackgroundImage POST /api/v1/assets/background-image (auth)
// multipart/form-data: file=<image>
func (h *Assets) UploadBackgroundImage(c *fiber.Ctx) error {
	uid, ok := middleware.UserID(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if h.s3 == nil {
		return c.Status(503).JSON(fiber.Map{"error": "storage_not_configured"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file_required"})
	}
	if fh.Size <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "empty_file"})
	}
	// background biasanya lebih besar
	if fh.Size > 8*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "file_too_large"})
	}

	f, err := fh.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file_open_failed"})
	}
	defer f.Close()

	buf, err := io.ReadAll(io.LimitReader(f, 8*1024*1024+1))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "read_failed"})
	}
	if len(buf) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "empty_file"})
	}

	contentType := sniffContentType(fh.Filename, buf)
	if !strings.HasPrefix(contentType, "image/") {
		return c.Status(400).JSON(fiber.Map{"error": "unsupported_file_type"})
	}

	key := buildBackgroundImageKey(uid, fh.Filename)
	url, err := h.s3.PutPublicObject(c.Context(), key, buf, contentType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "upload_failed"})
	}

	return c.JSON(fiber.Map{
		"url": url,
		"key": key,
	})
}

func buildHeaderImageKey(userID uuid.UUID, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" || len(ext) > 10 {
		ext = ".jpg"
	}
	rb := make([]byte, 16)
	_, _ = rand.Read(rb)
	rnd := hex.EncodeToString(rb)
	// assets/users/<uid>/header/<timestamp>-<rand>.<ext>
	return fmt.Sprintf("assets/users/%s/header/%d-%s%s", userID.String(), time.Now().Unix(), rnd, ext)
}

func buildBackgroundImageKey(userID uuid.UUID, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" || len(ext) > 10 {
		ext = ".jpg"
	}
	rb := make([]byte, 16)
	_, _ = rand.Read(rb)
	rnd := hex.EncodeToString(rb)
	return fmt.Sprintf("assets/users/%s/background/%d-%s%s", userID.String(), time.Now().Unix(), rnd, ext)
}

func sniffContentType(filename string, data []byte) string {
	ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(filename)))
	if ct != "" {
		return ct
	}
	return http.DetectContentType(data)
}

