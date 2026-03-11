package client_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nerveband/agent-to-bricks/internal/client"
)

func TestGetElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/elements" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("unexpected method: %s", r.Method)
		}
		// Check X-ATB-Key header
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elements":    []interface{}{},
			"contentHash": "abc123",
			"count":       0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetElements(2005)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ContentHash != "abc123" {
		t.Errorf("expected hash abc123, got %s", resp.ContentHash)
	}
}

func TestGetSiteInfo(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/info" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bricksVersion":  "2.2",
			"contentMetaKey": "_bricks_page_content_2",
			"elementTypes":   []string{"section", "heading"},
			"breakpoints":    []interface{}{},
			"pluginVersion":  "1.3.0",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	info, err := c.GetSiteInfo()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.BricksVersion != "2.2" {
		t.Errorf("expected bricks 2.2, got %s", info.BricksVersion)
	}
	if len(info.ElementTypes) != 2 {
		t.Errorf("expected 2 element types, got %d", len(info.ElementTypes))
	}
}

func TestUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "bad_key")
	_, err := c.GetSiteInfo()
	if err == nil {
		t.Error("expected error for 401")
	}
}

func TestReplaceElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PUT" {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		if r.Header.Get("If-Match") != "hash123" {
			t.Errorf("expected If-Match hash123, got %s", r.Header.Get("If-Match"))
		}
		if r.Header.Get("X-ATB-Key") != "atb_testkey" {
			w.WriteHeader(401)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "newhash",
			"count":       2,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	elements := []map[string]interface{}{
		{"id": "e1", "name": "heading"},
		{"id": "e2", "name": "text"},
	}
	resp, err := c.ReplaceElements(2005, elements, "hash123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.ContentHash != "newhash" {
		t.Errorf("expected newhash, got %s", resp.ContentHash)
	}
}

func TestPatchElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" {
			t.Errorf("expected PATCH, got %s", r.Method)
		}
		if r.Header.Get("If-Match") != "oldhash" {
			t.Errorf("expected If-Match oldhash, got %s", r.Header.Get("If-Match"))
		}
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if _, ok := body["patches"]; !ok {
			t.Fatalf("expected request body to contain patches, got %v", body)
		}
		if _, ok := body["elements"]; ok {
			t.Fatalf("expected request body to omit elements field, got %v", body)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "patched",
			"count":       1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	patches := []map[string]interface{}{
		{"id": "e1", "settings": map[string]interface{}{"text": "Updated"}},
	}
	resp, err := c.PatchElements(2005, patches, "oldhash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ContentHash != "patched" {
		t.Errorf("expected patched, got %s", resp.ContentHash)
	}
}

func TestCreateSnapshot(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/snapshots" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"snapshotId":  "snap_abc",
			"contentHash": "snaphash",
			"label":       "Before edit",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.CreateSnapshot(2005, "Before edit")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.SnapshotID != "snap_abc" {
		t.Errorf("expected snap_abc, got %s", resp.SnapshotID)
	}
}

func TestRollback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/wp-json/agent-bricks/v1/pages/2005/snapshots/snap_abc/rollback" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":     true,
			"contentHash": "restored",
			"restored":    "snap_abc",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.Rollback(2005, "snap_abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.ContentHash != "restored" {
		t.Errorf("expected restored, got %s", resp.ContentHash)
	}
}

func TestTriggerPluginUpdate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/update" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		if body["version"] != "1.4.0" {
			t.Errorf("expected version 1.4.0, got %s", body["version"])
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":         true,
			"version":         "1.4.0",
			"previousVersion": "1.3.0",
		})
	}))
	defer server.Close()

	c := client.New(server.URL, "test-key")
	result, err := c.TriggerPluginUpdate("1.4.0")
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != "1.4.0" {
		t.Errorf("expected 1.4.0, got %s", result.Version)
	}
	if result.PreviousVersion != "1.3.0" {
		t.Errorf("expected 1.3.0, got %s", result.PreviousVersion)
	}
}

func TestVersionHeaderWarning(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-ATB-Version", "1.5.0")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bricksVersion": "1.12", "pluginVersion": "1.5.0",
			"wpVersion": "6.7", "phpVersion": "8.2",
		})
	}))
	defer server.Close()

	c := client.New(server.URL, "test-key")
	c.SetCLIVersion("1.4.0")
	_, err := c.GetSiteInfo()
	if err != nil {
		t.Fatal(err)
	}
	if c.LastPluginVersion() != "1.5.0" {
		t.Errorf("expected 1.5.0, got %s", c.LastPluginVersion())
	}
}

func TestListMedia(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/media" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"media": []map[string]interface{}{
				{"id": 10, "title": "logo.png", "url": "https://example.com/logo.png", "mimeType": "image/png", "date": "2025-01-01", "filesize": 1024},
			},
			"count": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListMedia("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 1 {
		t.Errorf("expected count 1, got %d", resp.Count)
	}
	if resp.Media[0].Title != "logo.png" {
		t.Errorf("expected title logo.png, got %s", resp.Media[0].Title)
	}
}

func TestListMediaWithSearch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/media" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("search") != "logo" {
			t.Errorf("expected search=logo, got %s", r.URL.Query().Get("search"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"media": []map[string]interface{}{},
			"count": 0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListMedia("logo")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 0 {
		t.Errorf("expected count 0, got %d", resp.Count)
	}
}

func TestUploadMedia(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/media/upload" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		ct := r.Header.Get("Content-Type")
		if !strings.HasPrefix(ct, "multipart/form-data") {
			t.Errorf("expected multipart content type, got %s", ct)
		}
		// Parse the multipart to verify file field exists
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			t.Fatalf("failed to parse multipart: %v", err)
		}
		if _, _, err := r.FormFile("file"); err != nil {
			t.Fatalf("expected file field: %v", err)
		}
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":       42,
			"url":      "https://example.com/uploads/test.txt",
			"mimeType": "text/plain",
			"filename": "test.txt",
			"filesize": 13,
		})
	}))
	defer srv.Close()

	// Create a temp file to upload
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test.txt")
	if err := os.WriteFile(tmpFile, []byte("hello upload!"), 0644); err != nil {
		t.Fatal(err)
	}

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.UploadMedia(tmpFile)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != 42 {
		t.Errorf("expected ID 42, got %d", resp.ID)
	}
	if resp.Filename != "test.txt" {
		t.Errorf("expected filename test.txt, got %s", resp.Filename)
	}
}

func TestUploadMediaFileNotFound(t *testing.T) {
	c := client.New("http://localhost", "atb_testkey")
	_, err := c.UploadMedia("/nonexistent/file.txt")
	if err == nil {
		t.Error("expected error for missing file")
	}
}

func TestSearchElements(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/search/elements" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		if r.URL.Query().Get("element_type") != "heading" {
			t.Errorf("expected element_type=heading, got %s", r.URL.Query().Get("element_type"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{
				{"postId": 42, "postTitle": "Home", "postType": "page", "elementId": "abc", "elementType": "heading", "parentId": 0},
			},
			"total":      1,
			"page":       1,
			"perPage":    50,
			"totalPages": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.SearchElements(client.SearchParams{ElementType: "heading"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected total 1, got %d", resp.Total)
	}
	if resp.Results[0].ElementType != "heading" {
		t.Errorf("expected heading, got %s", resp.Results[0].ElementType)
	}
	if string(resp.Results[0].ParentID) != "0" {
		t.Errorf("expected parent id 0, got %q", resp.Results[0].ParentID)
	}
}

func TestListComponents(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/components" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"components": []map[string]interface{}{
				{"id": 89, "title": "Hero Block", "type": "section", "status": "publish", "elementCount": 5},
			},
			"count": 1,
			"total": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListComponents()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 1 {
		t.Errorf("expected 1, got %d", resp.Count)
	}
	if resp.Components[0].Title != "Hero Block" {
		t.Errorf("expected Hero Block, got %s", resp.Components[0].Title)
	}
}

func TestGetComponent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/components/89" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id": 89, "title": "Hero Block", "type": "section",
			"elements":    []interface{}{},
			"contentHash": "hash123",
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetComponent(89)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Title != "Hero Block" {
		t.Errorf("expected Hero Block, got %s", resp.Title)
	}
}

func TestListElementTypes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/element-types" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{
				{"name": "heading", "label": "Heading", "category": "basic", "icon": "ti-text"},
				{"name": "section", "label": "Section", "category": "layout", "icon": "ti-layout"},
			},
			"count": 2,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListElementTypes(false, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 2 {
		t.Errorf("expected 2, got %d", resp.Count)
	}
	if resp.ElementTypes[0].Name != "heading" {
		t.Errorf("expected heading, got %s", resp.ElementTypes[0].Name)
	}
}

func TestListElementTypesWithControls(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("include_controls") != "1" {
			t.Error("expected include_controls=1")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{
				{
					"name": "heading", "label": "Heading", "category": "basic",
					"controls": map[string]interface{}{
						"text": map[string]interface{}{"type": "text", "label": "Text"},
					},
				},
			},
			"count": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListElementTypes(true, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ElementTypes[0].Controls == nil {
		t.Error("expected controls")
	}
}

func TestListElementTypesByCategory(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("category") != "media" {
			t.Errorf("expected category=media, got %s", r.URL.Query().Get("category"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"elementTypes": []map[string]interface{}{},
			"count":        0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	_, err := c.ListElementTypes(false, "media")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetSiteFeatures(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/features" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bricks":            map[string]interface{}{"active": true, "version": "2.2"},
			"wordpress":         map[string]interface{}{"version": "6.9.2"},
			"plugin":            map[string]interface{}{"version": "2.0.0"},
			"abilities":         map[string]interface{}{"available": true},
			"frameworks":        []string{"acss"},
			"queryElements":     []string{"posts", "slider"},
			"queryElementCount": 2,
			"woocommerce":       map[string]interface{}{"active": false, "version": "", "elementTypes": []string{}},
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetSiteFeatures()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Bricks.Active || resp.Bricks.Version != "2.2" {
		t.Fatalf("unexpected bricks payload: %+v", resp.Bricks)
	}
	if resp.QueryElementCount != 2 {
		t.Fatalf("expected query element count 2, got %d", resp.QueryElementCount)
	}
}

func TestListQueryElementTypes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/query-elements" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("include_controls") != "1" {
			t.Errorf("expected include_controls=1, got %q", r.URL.Query().Get("include_controls"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"queryElements": []map[string]interface{}{
				{"name": "posts", "label": "Posts", "category": "wordpress", "icon": "icon", "controls": map[string]interface{}{"query": map[string]interface{}{"type": "query"}}},
			},
			"count": 1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListQueryElementTypes(true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 1 || resp.QueryElements[0].Name != "posts" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestGetWooStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/site/woocommerce" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"active":            true,
			"version":           "9.8.1",
			"hpos":              true,
			"productPostType":   true,
			"productCategories": true,
			"productTags":       true,
			"elementTypes":      []string{"product-add-to-cart"},
			"elementTypeCount":  1,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.GetWooStatus()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Active || resp.ElementTypeCount != 1 {
		t.Fatalf("unexpected woo status: %+v", resp)
	}
}

func TestListWooProducts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/woo/products" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("search") != "hoodie" {
			t.Errorf("expected search=hoodie, got %q", r.URL.Query().Get("search"))
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"products": []map[string]interface{}{
				{"id": 7, "title": "Hoodie", "slug": "hoodie", "status": "publish", "sku": "HD-1", "price": "39.00"},
			},
			"count": 1, "total": 1, "page": 1, "perPage": 20, "totalPages": 1, "woocommerceActive": true,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListWooProducts("hoodie", 20, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Count != 1 || resp.Products[0].Title != "Hoodie" {
		t.Fatalf("unexpected products response: %+v", resp)
	}
}

func TestListWooProductCategories(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/woo/product-categories" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"categories": []map[string]interface{}{
				{"id": 3, "name": "Accessories", "slug": "accessories", "count": 4},
			},
			"count":             1,
			"woocommerceActive": true,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListWooProductCategories("", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Categories) != 1 || resp.Categories[0].Name != "Accessories" {
		t.Fatalf("unexpected category response: %+v", resp)
	}
}

func TestListWooProductTags(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/wp-json/agent-bricks/v1/woo/product-tags" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"tags": []map[string]interface{}{
				{"id": 8, "name": "Featured", "slug": "featured", "count": 2},
			},
			"count":             1,
			"woocommerceActive": true,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.ListWooProductTags("", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Tags) != 1 || resp.Tags[0].Name != "Featured" {
		t.Fatalf("unexpected tag response: %+v", resp)
	}
}

func TestSearchElementsWithSettingFilter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("setting_key") != "tag" {
			t.Errorf("expected setting_key=tag")
		}
		if r.URL.Query().Get("setting_value") != "h1" {
			t.Errorf("expected setting_value=h1")
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"results": []map[string]interface{}{},
			"total":   0, "page": 1, "perPage": 50, "totalPages": 0,
		})
	}))
	defer srv.Close()

	c := client.New(srv.URL, "atb_testkey")
	resp, err := c.SearchElements(client.SearchParams{SettingKey: "tag", SettingValue: "h1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 0 {
		t.Errorf("expected 0, got %d", resp.Total)
	}
}
