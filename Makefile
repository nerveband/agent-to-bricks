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

INSTALL_DIR ?= $(shell \
	if [ -d /opt/homebrew/bin ] && [ -w /opt/homebrew/bin ]; then echo /opt/homebrew/bin; \
	elif [ -d "$(HOME)/.local/bin" ] && [ -w "$(HOME)/.local/bin" ]; then echo $(HOME)/.local/bin; \
	elif [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then echo /usr/local/bin; \
	else echo $(HOME)/.local/bin; fi)

install: build
	@mkdir -p $(INSTALL_DIR)
	cp bin/bricks $(INSTALL_DIR)/bricks
	@echo "Installed to $(INSTALL_DIR)/bricks"
	@case "$$PATH" in *$(INSTALL_DIR)*) ;; *) echo "WARNING: $(INSTALL_DIR) is not in your PATH. Add it with:"; \
		echo "  echo 'export PATH=\"$(INSTALL_DIR):\$$PATH\"' >> ~/.zshrc  # or ~/.bashrc"; esac

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
