package auth

import (
	"crypto/rand"
	"encoding/base64"
)

// GenerateVerifyToken token acak untuk konfirmasi email (URL-safe).
func GenerateVerifyToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
