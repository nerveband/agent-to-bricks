.PHONY: build test clean install lint sync-version check-version

VERSION ?= $(shell cat VERSION 2>/dev/null || git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
DATE    ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS  = -s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(DATE)

build:
	cd cli && CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o ../bin/bricks .

test:
	cd cli && go test ./...

test-verbose:
	cd cli && go test -v ./...

clean:
	rm -rf bin/

install: build
	cp bin/bricks /usr/local/bin/bricks

lint:
	cd cli && go vet ./...

snapshot:
	cd cli && goreleaser release --snapshot --clean

sync-version:
	./scripts/sync-version.sh

check-version:
	./scripts/sync-version.sh --check

# Plugin deployment
deploy-staging:
	./scripts/deploy-staging.sh

.PHONY: release-prep tag-release

# Sync versions, run all tests, then prompt for commit
release-prep: sync-version
	cd cli && go test ./...
	cd gui && npm run build
	@echo ""
	@echo "All versions synced and tests passed."
	@echo "Commit with: git commit -am 'chore: bump version to $(VERSION)'"

# Create and push a release tag from VERSION file
tag-release:
	@echo "Tagging v$(VERSION)..."
	git tag "v$(VERSION)"
	git push origin "v$(VERSION)"
	@echo "Tag v$(VERSION) pushed. GitHub Actions will build the release."
