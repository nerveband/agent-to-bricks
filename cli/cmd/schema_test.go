package cmd

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSchemaFileIsValidJSON(t *testing.T) {
	data, err := os.ReadFile("../schema.json")
	if err != nil {
		t.Fatalf("failed to read schema.json: %v", err)
	}
	var schema map[string]interface{}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatalf("schema.json is not valid JSON: %v", err)
	}
	if schema["name"] != "bricks" {
		t.Errorf("expected name=bricks, got %v", schema["name"])
	}
	commands, ok := schema["commands"].(map[string]interface{})
	if !ok {
		t.Fatal("expected commands to be an object")
	}
	// Verify a few known commands exist
	for _, cmd := range []string{"site push", "convert html", "agent context", "classes list"} {
		if _, ok := commands[cmd]; !ok {
			t.Errorf("expected command %q in schema", cmd)
		}
	}
	// Verify error codes exist
	if _, ok := schema["errorCodes"]; !ok {
		t.Error("expected errorCodes in schema")
	}
}
