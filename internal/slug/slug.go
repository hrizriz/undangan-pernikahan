package slug

import (
	"regexp"
	"strings"
)

var strip = regexp.MustCompile(`[^a-z0-9]+`)

// Normalize membuat slug aman untuk URL: huruf kecil, hanya a-z 0-9 dan tanda hubung.
func Normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strip.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return s
}
