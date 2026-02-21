package updater

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// DetectPlatform returns the current OS and architecture.
func DetectPlatform() (string, string) {
	return runtime.GOOS, runtime.GOARCH
}

// CurrentBinaryPath returns the path of the running binary.
func CurrentBinaryPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(exe)
}

// DownloadFile downloads a URL to a local path, overwriting it.
// If the URL ends in .tar.gz, it extracts the first binary from the archive.
// Otherwise it writes the raw bytes.
func DownloadFile(url, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	if strings.HasSuffix(url, ".tar.gz") || strings.HasSuffix(url, ".tgz") {
		return extractTarGz(resp.Body, destPath)
	}

	return writeToFile(resp.Body, destPath)
}

func extractTarGz(r io.Reader, destPath string) error {
	// Buffer the entire body so we can fall back to raw write if it's not gzipped.
	body, err := io.ReadAll(r)
	if err != nil {
		return err
	}

	gz, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		// Not actually gzipped — treat as raw file
		return writeToFile(bytes.NewReader(body), destPath)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if header.Typeflag == tar.TypeReg {
			name := filepath.Base(header.Name)
			if name == "bricks" || strings.HasPrefix(name, "bricks") {
				return writeToFile(tr, destPath)
			}
		}
	}
	return fmt.Errorf("no bricks binary found in archive")
}

func writeToFile(r io.Reader, destPath string) error {
	tmpPath := destPath + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return err
	}
	f.Close()

	return os.Rename(tmpPath, destPath)
}

// SelfUpdate downloads a new CLI binary and replaces the current one.
func SelfUpdate(downloadURL string) error {
	binPath, err := CurrentBinaryPath()
	if err != nil {
		return fmt.Errorf("cannot determine binary path: %w", err)
	}
	return DownloadFile(downloadURL, binPath)
}
