package output

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"

	clierrors "github.com/nerveband/agent-to-bricks/internal/errors"
	"github.com/spf13/cobra"
)

func TestAddFormatFlags(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)

	f := cmd.Flags().Lookup("format")
	if f == nil {
		t.Fatal("expected --format flag to be registered")
	}
	j := cmd.Flags().Lookup("json")
	if j == nil {
		t.Fatal("expected --json flag to be registered")
	}
}

func TestResolveFormatFromJSONFlag(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)
	cmd.Flags().Set("json", "true")
	ResolveFormat(cmd)
	if GetFormat() != "json" {
		t.Errorf("expected format=json when --json is set, got %q", GetFormat())
	}
	Reset()
}

func TestResolveFormatExplicit(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	AddFormatFlags(cmd)
	cmd.Flags().Set("format", "table")
	ResolveFormat(cmd)
	if GetFormat() != "table" {
		t.Errorf("expected format=table, got %q", GetFormat())
	}
	Reset()
}

func TestIsJSON(t *testing.T) {
	format = "json"
	defer func() { format = "" }()
	if !IsJSON() {
		t.Error("expected IsJSON() to return true")
	}
}

func TestJSONOutputToStdout(t *testing.T) {
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	data := map[string]string{"name": "test"}
	JSON(data)

	w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	buf.ReadFrom(r)

	var result map[string]string
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("output is not valid JSON: %v", err)
	}
	if result["name"] != "test" {
		t.Errorf("expected name=test, got %q", result["name"])
	}
}

func TestJSONErrorToStderr(t *testing.T) {
	old := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	cliErr := clierrors.ConfigError("CONFIG_NOT_FOUND", "no config", "Run: bricks config init")
	JSONError(cliErr)

	w.Close()
	os.Stderr = old

	var buf bytes.Buffer
	buf.ReadFrom(r)

	var result map[string]map[string]interface{}
	if err := json.Unmarshal(buf.Bytes(), &result); err != nil {
		t.Fatalf("error output is not valid JSON: %v\nGot: %s", err, buf.String())
	}
	errObj := result["error"]
	if errObj["code"] != "CONFIG_NOT_FOUND" {
		t.Errorf("expected error code CONFIG_NOT_FOUND, got %v", errObj["code"])
	}
}
