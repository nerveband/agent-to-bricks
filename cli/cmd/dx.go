package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/nerveband/agent-to-bricks/internal/output"
	"github.com/spf13/cobra"
)

type dxOptions struct {
	Fields  []string
	Limit   int
	Page    int
	PageAll bool
	NDJSON  bool
	DryRun  bool
}

func addReadDXFlags(cmd *cobra.Command, defaultLimit int) {
	if cmd.Flags().Lookup("fields") == nil {
		cmd.Flags().String("fields", "", "comma-separated fields to include in JSON output")
	}
	if cmd.Flags().Lookup("limit") == nil {
		cmd.Flags().Int("limit", defaultLimit, "max rows to return")
	}
	if cmd.Flags().Lookup("page") == nil {
		cmd.Flags().Int("page", 1, "result page")
	}
	if cmd.Flags().Lookup("page-all") == nil {
		cmd.Flags().Bool("page-all", false, "fetch or emit all result pages where supported")
	}
	if cmd.Flags().Lookup("ndjson") == nil {
		cmd.Flags().Bool("ndjson", false, "emit row-oriented newline-delimited JSON")
	}
}

func addFieldsFlag(cmd *cobra.Command) {
	if cmd.Flags().Lookup("fields") == nil {
		cmd.Flags().String("fields", "", "comma-separated fields to include in JSON output")
	}
}

func addDryRunFlag(cmd *cobra.Command) {
	if cmd.Flags().Lookup("dry-run") == nil {
		cmd.Flags().Bool("dry-run", false, "show the planned mutation without side effects")
	}
}

func getDX(cmd *cobra.Command) dxOptions {
	var o dxOptions
	if cmd.Flags().Lookup("fields") != nil {
		raw, _ := cmd.Flags().GetString("fields")
		for _, part := range strings.Split(raw, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				o.Fields = append(o.Fields, part)
			}
		}
	}
	if cmd.Flags().Lookup("limit") != nil {
		o.Limit, _ = cmd.Flags().GetInt("limit")
	}
	if cmd.Flags().Lookup("page") != nil {
		o.Page, _ = cmd.Flags().GetInt("page")
	}
	if o.Page < 1 {
		o.Page = 1
	}
	if cmd.Flags().Lookup("page-all") != nil {
		o.PageAll, _ = cmd.Flags().GetBool("page-all")
	}
	if cmd.Flags().Lookup("ndjson") != nil {
		o.NDJSON, _ = cmd.Flags().GetBool("ndjson")
	}
	if cmd.Flags().Lookup("dry-run") != nil {
		o.DryRun, _ = cmd.Flags().GetBool("dry-run")
	}
	return o
}

func writeDXJSON(cmd *cobra.Command, v interface{}) error {
	o := getDX(cmd)
	data := normalizeJSON(v)
	if len(o.Fields) > 0 {
		data = selectFields(data, o.Fields)
	}
	return output.JSON(data)
}

func writeDXCollection(cmd *cobra.Command, rows interface{}, envelope map[string]interface{}, listKey string) error {
	o := getDX(cmd)
	items := normalizeSlice(rows)
	if !o.PageAll {
		items = paginate(items, o.Limit, o.Page)
	}
	if len(o.Fields) > 0 {
		for i := range items {
			items[i] = selectFields(items[i], o.Fields)
		}
	}
	if o.NDJSON {
		enc := json.NewEncoder(os.Stdout)
		for _, item := range items {
			if err := enc.Encode(item); err != nil {
				return err
			}
		}
		return nil
	}
	if envelope == nil {
		envelope = map[string]interface{}{}
	}
	envelope[listKey] = items
	envelope["count"] = len(items)
	return output.JSON(envelope)
}

func dryRun(cmd *cobra.Command, method, endpoint string, payload interface{}) error {
	body := map[string]interface{}{
		"dryRun":   true,
		"method":   method,
		"endpoint": endpoint,
		"payload":  payload,
	}
	if output.IsJSON() {
		return output.JSON(body)
	}
	return output.JSON(body)
}

func normalizeJSON(v interface{}) interface{} {
	data, _ := json.Marshal(v)
	var out interface{}
	if err := json.Unmarshal(data, &out); err != nil {
		return v
	}
	return out
}

func normalizeSlice(v interface{}) []interface{} {
	data, _ := json.Marshal(v)
	var out []interface{}
	if err := json.Unmarshal(data, &out); err == nil {
		return out
	}
	return nil
}

func paginate(items []interface{}, limit, page int) []interface{} {
	if limit <= 0 {
		return items
	}
	if page < 1 {
		page = 1
	}
	start := (page - 1) * limit
	if start >= len(items) {
		return []interface{}{}
	}
	end := start + limit
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

func selectFields(v interface{}, fields []string) interface{} {
	m, ok := v.(map[string]interface{})
	if !ok {
		return v
	}
	out := map[string]interface{}{}
	for _, field := range fields {
		if value, ok := getPath(m, strings.Split(field, ".")); ok {
			setPath(out, strings.Split(field, "."), value)
		}
	}
	return out
}

func getPath(m map[string]interface{}, parts []string) (interface{}, bool) {
	if len(parts) == 0 {
		return m, true
	}
	value, ok := m[parts[0]]
	if !ok {
		return nil, false
	}
	if len(parts) == 1 {
		return value, true
	}
	next, ok := value.(map[string]interface{})
	if !ok {
		return nil, false
	}
	return getPath(next, parts[1:])
}

func setPath(m map[string]interface{}, parts []string, value interface{}) {
	if len(parts) == 1 {
		m[parts[0]] = value
		return
	}
	child, _ := m[parts[0]].(map[string]interface{})
	if child == nil {
		child = map[string]interface{}{}
		m[parts[0]] = child
	}
	setPath(child, parts[1:], value)
}

func parsePositiveInt(raw, label string) (int, error) {
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("invalid %s: %s", label, raw)
	}
	return n, nil
}
