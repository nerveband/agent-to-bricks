package embeddings

import (
	"math"
	"sort"
	"strings"
	"unicode"
)

// Document represents an indexed item.
type Document struct {
	ID          string
	Name        string
	Description string
	Category    string
	Tags        []string
	tokens      []string
}

// SearchResult represents a search match.
type SearchResult struct {
	ID    string
	Name  string
	Score float64
}

// Index holds the search index.
type Index struct {
	docs     []*Document
	idf      map[string]float64
	docFreq  map[string]int
	totalDocs int
}

// NewIndex creates a new search index.
func NewIndex() *Index {
	return &Index{
		idf:     make(map[string]float64),
		docFreq: make(map[string]int),
	}
}

// Add indexes a document.
func (idx *Index) Add(id, name, description, category string, tags []string) {
	text := strings.Join([]string{name, description, category, strings.Join(tags, " ")}, " ")
	tokens := tokenize(text)

	doc := &Document{
		ID:          id,
		Name:        name,
		Description: description,
		Category:    category,
		Tags:        tags,
		tokens:      tokens,
	}
	idx.docs = append(idx.docs, doc)

	// Update document frequency
	seen := make(map[string]bool)
	for _, t := range tokens {
		if !seen[t] {
			idx.docFreq[t]++
			seen[t] = true
		}
	}
	idx.totalDocs++

	// Recalculate IDF
	idx.recalcIDF()
}

// Search finds documents matching a query, ranked by TF-IDF cosine similarity.
func (idx *Index) Search(query string, limit int) []SearchResult {
	queryTokens := tokenize(query)
	if len(queryTokens) == 0 {
		return nil
	}

	queryVec := idx.tfidf(queryTokens)

	type scoredDoc struct {
		doc   *Document
		score float64
	}
	var scored []scoredDoc

	for _, doc := range idx.docs {
		docVec := idx.tfidf(doc.tokens)
		score := cosineSimilarity(queryVec, docVec)
		if score > 0 {
			scored = append(scored, scoredDoc{doc, score})
		}
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	if limit > 0 && len(scored) > limit {
		scored = scored[:limit]
	}

	results := make([]SearchResult, len(scored))
	for i, s := range scored {
		results[i] = SearchResult{
			ID:    s.doc.ID,
			Name:  s.doc.Name,
			Score: s.score,
		}
	}
	return results
}

// Count returns the number of indexed documents.
func (idx *Index) Count() int {
	return len(idx.docs)
}

func (idx *Index) recalcIDF() {
	for term, df := range idx.docFreq {
		idx.idf[term] = math.Log(float64(idx.totalDocs+1) / float64(df+1))
	}
}

func (idx *Index) tfidf(tokens []string) map[string]float64 {
	tf := make(map[string]int)
	for _, t := range tokens {
		tf[t]++
	}

	vec := make(map[string]float64)
	for term, count := range tf {
		idf := idx.idf[term]
		if idf == 0 {
			idf = math.Log(float64(idx.totalDocs+1) / 1.0)
		}
		vec[term] = float64(count) / float64(len(tokens)) * idf
	}
	return vec
}

func cosineSimilarity(a, b map[string]float64) float64 {
	dot := 0.0
	magA := 0.0
	magB := 0.0

	for k, v := range a {
		magA += v * v
		if bv, ok := b[k]; ok {
			dot += v * bv
		}
	}
	for _, v := range b {
		magB += v * v
	}

	if magA == 0 || magB == 0 {
		return 0
	}
	return dot / (math.Sqrt(magA) * math.Sqrt(magB))
}

func tokenize(text string) []string {
	text = strings.ToLower(text)
	var tokens []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' {
			current.WriteRune(r)
		} else {
			if current.Len() > 0 {
				t := current.String()
				if len(t) > 1 { // skip single-char tokens
					tokens = append(tokens, t)
				}
				current.Reset()
			}
		}
	}
	if current.Len() > 0 {
		t := current.String()
		if len(t) > 1 {
			tokens = append(tokens, t)
		}
	}

	return tokens
}
