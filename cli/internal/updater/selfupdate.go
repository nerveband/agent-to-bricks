package updater

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
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

// DownloadAndVerify downloads a URL, verifies its SHA256 against checksums, then extracts.
func DownloadAndVerify(archiveURL, checksumsURL, destPath string) error {
	// 1. Download checksums.txt
	expectedHash, archiveName, err := fetchExpectedChecksum(checksumsURL, archiveURL)
	if err != nil {
		// Fall back to unverified download if checksums unavailable
		fmt.Fprintf(os.Stderr, "Warning: checksum verification unavailable: %v\n", err)
		return DownloadFile(archiveURL, destPath)
	}

	// 2. Download archive into memory
	resp, err := http.Get(archiveURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	// 3. Verify checksum
	if expectedHash != "" {
		actualHash := sha256.Sum256(body)
		actualHex := hex.EncodeToString(actualHash[:])
		if actualHex != expectedHash {
			return fmt.Errorf("checksum mismatch for %s: expected %s, got %s", archiveName, expectedHash, actualHex)
		}
	}

	// 4. Extract
	reader := bytes.NewReader(body)
	if strings.HasSuffix(archiveURL, ".tar.gz") || strings.HasSuffix(archiveURL, ".tgz") {
		return extractTarGz(reader, destPath)
	}
	return writeToFile(reader, destPath)
}

// DownloadFile downloads a URL to a local path (legacy, no checksum).
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

func fetchExpectedChecksum(checksumsURL, archiveURL string) (string, string, error) {
	resp, err := http.Get(checksumsURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", "", fmt.Errorf("checksums.txt returned HTTP %d", resp.StatusCode)
	}

	archiveName := filepath.Base(archiveURL)
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		// Format: "<hash>  <filename>" (two spaces)
		parts := strings.SplitN(line, "  ", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[1]) == archiveName {
			return strings.TrimSpace(parts[0]), archiveName, nil
		}
	}

	return "", archiveName, fmt.Errorf("no checksum found for %s", archiveName)
}

func extractTarGz(r io.Reader, destPath string) error {
	body, err := io.ReadAll(r)
	if err != nil {
		return err
	}

	gz, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
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

// SelfUpdate downloads a new CLI binary with checksum verification and replaces the current one.
func SelfUpdate(downloadURL, checksumsURL string) error {
	binPath, err := CurrentBinaryPath()
	if err != nil {
		return fmt.Errorf("cannot determine binary path: %w", err)
	}
	if checksumsURL != "" {
		return DownloadAndVerify(downloadURL, checksumsURL, binPath)
	}
	return DownloadFile(downloadURL, binPath)
}
