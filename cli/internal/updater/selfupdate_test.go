package updater

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestSelfUpdate(t *testing.T) {
	fakeContent := []byte("#!/bin/sh\necho updated")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(fakeContent)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	destPath := filepath.Join(tmpDir, "bricks")
	os.WriteFile(destPath, []byte("old binary"), 0755)

	err := DownloadFile(server.URL+"/test.tar.gz", destPath)
	if err != nil {
		t.Fatal(err)
	}

	data, _ := os.ReadFile(destPath)
	if string(data) != string(fakeContent) {
		t.Errorf("expected updated content, got %s", string(data))
	}
}

func TestDetectPlatform(t *testing.T) {
	goos, goarch := DetectPlatform()
	if goos != runtime.GOOS {
		t.Errorf("expected %s, got %s", runtime.GOOS, goos)
	}
	if goarch != runtime.GOARCH {
		t.Errorf("expected %s, got %s", runtime.GOARCH, goarch)
	}
}
