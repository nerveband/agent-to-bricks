package security

import (
	"fmt"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"
)

func PageID(raw string) (int, error) {
	if raw == "" {
		return 0, fmt.Errorf("page ID is required")
	}
	for _, r := range raw {
		if r < '0' || r > '9' {
			return 0, fmt.Errorf("invalid page ID %q: use digits only", raw)
		}
	}
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid page ID %q", raw)
	}
	return id, nil
}

func ResourceID(kind, raw string) error {
	if raw == "" {
		return fmt.Errorf("%s is required", kind)
	}
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return fmt.Errorf("invalid %s %q: bad percent encoding", kind, raw)
	}
	for _, r := range decoded {
		if unicode.IsControl(r) {
			return fmt.Errorf("invalid %s %q: control characters are not allowed", kind, raw)
		}
	}
	if strings.Contains(decoded, "../") || strings.Contains(decoded, `..\`) ||
		strings.Contains(decoded, "?") || strings.Contains(decoded, "#") ||
		strings.Contains(decoded, "/") || strings.Contains(decoded, `\`) {
		return fmt.Errorf("invalid %s %q: path/query fragments are not allowed", kind, raw)
	}
	if decoded == "." || decoded == ".." {
		return fmt.Errorf("invalid %s %q", kind, raw)
	}
	return nil
}

func OutputPath(raw string, allowAbsolute bool) error {
	if raw == "" {
		return nil
	}
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		return fmt.Errorf("invalid output path %q: bad percent encoding", raw)
	}
	for _, r := range decoded {
		if unicode.IsControl(r) {
			return fmt.Errorf("invalid output path %q: control characters are not allowed", raw)
		}
	}
	clean := filepath.Clean(decoded)
	if !allowAbsolute && filepath.IsAbs(clean) {
		return fmt.Errorf("invalid output path %q: absolute paths require an explicit allowlist", raw)
	}
	if clean == ".." || strings.HasPrefix(clean, "../") || strings.Contains(clean, string(filepath.Separator)+".."+string(filepath.Separator)) {
		return fmt.Errorf("invalid output path %q: parent traversal is not allowed", raw)
	}
	return nil
}
